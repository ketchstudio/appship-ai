import fs from 'node:fs';
import path from 'node:path';
import { confirm } from '@inquirer/prompts';
import { AppshipError, log } from '../log.js';
import { ANDROID_TRACKS, loadProject, selectPlatforms } from '../config.js';
import { requireArtifact, runBuild } from '../artifacts.js';
import { androidContext, iosContext, requireCredentials } from '../context.js';
import { runLane, runTool, writeAscApiKeyJson } from '../fastlane.js';
import { validateAndroidMetadata, validateIosMetadata } from '../metadata.js';
import {
  androidManualChecklist,
  iosManualChecklist,
  validateAndroidQuestionnaire,
  validateIosQuestionnaire,
} from '../questionnaire.js';

/** "20%", "20" or "0.2" → 0.2 */
export function parseRollout(value) {
  if (value === undefined) return undefined;
  const n = Number(String(value).replace('%', ''));
  const fraction = String(value).includes('%') || n > 1 ? n / 100 : n;
  if (!(fraction > 0 && fraction <= 1)) throw new AppshipError(`Invalid rollout "${value}" — use e.g. 20% or 0.2`);
  return fraction;
}

/** Store-facing actions ask first; CI must pass --yes explicitly. */
async function confirmAction(message, opts) {
  if (opts.yes || opts.dryRun) return;
  if (!process.stdin.isTTY) throw new AppshipError(`${message} — pass --yes to confirm in non-interactive mode`);
  if (!(await confirm({ message, default: false }))) throw new AppshipError('Cancelled', { exitCode: 130 });
}

function assertMetadata(project, platform, { force, checkScreenshots }) {
  const cfg = project.config[platform];
  const opts = { primaryLocale: project.config.app.primary_locale, checkScreenshots };
  const { issues } =
    platform === 'ios'
      ? validateIosMetadata(project.resolve(cfg.metadata_path), project.resolve(cfg.screenshots_path), opts)
      : validateAndroidMetadata(project.resolve(cfg.metadata_path), opts);
  const errors = issues.filter((i) => i.level === 'error');
  if (!errors.length) return;
  errors.forEach((e) => log.fail(e.msg));
  if (!force) throw new AppshipError(`${platform} metadata has ${errors.length} error(s). Fix them or pass --force.`);
}

function assertQuestionnaire(project, platform, { force }) {
  const q = project.questionnaire[platform];
  const errors = !q ? [`questionnaire.yml has no "${platform}" section`] : platform === 'ios' ? validateIosQuestionnaire(q) : validateAndroidQuestionnaire(q);
  if (!errors.length) return;
  errors.forEach((e) => log.fail(e));
  if (!force) throw new AppshipError(`${platform} questionnaire is incomplete. Fix release/questionnaire.yml or pass --force.`);
}

export async function buildCommand(opts) {
  const project = loadProject();
  for (const platform of selectPlatforms(project, opts)) runBuild(project, platform);
}

export async function uploadCommand(opts) {
  const project = loadProject();
  const platforms = selectPlatforms(project, opts);
  if (opts.artifact && platforms.length > 1) throw new AppshipError('--artifact needs a single platform (--ios or --android)');
  if (opts.track && !ANDROID_TRACKS.includes(opts.track)) throw new AppshipError(`--track must be one of ${ANDROID_TRACKS.join(', ')}`);
  const rollout = parseRollout(opts.rollout);

  for (const platform of platforms) {
    if (opts.build) runBuild(project, platform);
    const artifact = requireArtifact(project, platform, opts.artifact);
    log.info(`  ${platform}: ${path.relative(project.root, artifact)}`);

    if (platform === 'ios') {
      const context = iosContext(project, { ios: { ipa: artifact, changelog: opts.changelog, groups: opts.groups?.split(','), distribute_external: Boolean(opts.groups) } });
      runLane(project, 'ios', 'upload', context, opts);
    } else {
      const context = androidContext(project, { track: opts.track, rollout, android: { aab: artifact, changelogs: true } });
      if (context.android.track === 'production') await confirmAction(`Upload to Google Play PRODUCTION (${Math.round((rollout ?? 1) * 100)}% rollout)?`, opts);
      runLane(project, 'android', 'upload', context, opts);
    }
  }
}

export async function metadataCommand(action = 'push', opts) {
  const project = loadProject();
  const platforms = selectPlatforms(project, opts);

  for (const platform of platforms) {
    const cfg = project.config[platform];
    if (action === 'pull') {
      const creds = requireCredentials(project, platform);
      if (platform === 'ios') {
        const keyJson = writeAscApiKeyJson(project, creds.ios);
        const base = ['--api_key_path', keyJson, '--app_identifier', cfg.bundle_id, '--force'];
        runTool(project, ['deliver', 'download_metadata', ...base, '--metadata_path', project.resolve(cfg.metadata_path)], opts);
        runTool(project, ['deliver', 'download_screenshots', ...base, '--screenshots_path', project.resolve(cfg.screenshots_path)], opts);
      } else {
        runTool(project, ['supply', 'init', '--package_name', cfg.package_name, '--json_key', creds.android.json_key_path, '--metadata_path', project.resolve(cfg.metadata_path)], opts);
      }
      continue;
    }
    if (action !== 'push') throw new AppshipError(`Unknown metadata action "${action}" (use push or pull)`);

    // commander sets screenshots=true unless --no-screenshots, so only `false` overrides the config.
    const screenshots = opts.screenshots === false ? false : cfg.upload_screenshots;
    assertMetadata(project, platform, { force: opts.force, checkScreenshots: screenshots });
    await confirmAction(`Overwrite the live ${platform} store listing with local metadata${screenshots ? ' and screenshots' : ''}?`, opts);
    const context = platform === 'ios' ? iosContext(project, { screenshots, version: opts.appVersion }) : androidContext(project, { screenshots });
    runLane(project, platform, 'metadata', context, opts);
  }
}

export async function submitCommand(opts) {
  const project = loadProject();
  const platforms = selectPlatforms(project, opts);
  const rollout = parseRollout(opts.rollout);

  for (const platform of platforms) {
    assertQuestionnaire(project, platform, opts);
    if (platform === 'ios') {
      if (!opts.skipMetadata) assertMetadata(project, 'ios', { force: opts.force, checkScreenshots: project.config.ios.upload_screenshots });
      const context = iosContext(project, { version: opts.appVersion, buildNumber: opts.buildNumber, skipMetadata: opts.skipMetadata });
      await confirmAction(
        `Submit ${project.config.app.name} ${context.ios.version ?? '(editable version)'} build ${context.ios.build_number ?? '(latest)'} for App Review?`,
        opts,
      );
      runLane(project, 'ios', 'submit', context, opts);
    } else {
      const from = opts.from ?? project.config.android.track;
      if (from === 'production') throw new AppshipError('android.track is already production — use "appship upload --android" instead');
      const context = androidContext(project, { rollout, android: { from_track: from, to_track: 'production', version_code: opts.versionCode } });
      await confirmAction(`Promote Android "${from}" → production (${Math.round((context.android.rollout ?? 1) * 100)}% rollout)? Google reviews it before it goes live.`, opts);
      runLane(project, 'android', 'promote', context, opts);
    }
  }
}

export async function promoteCommand(opts) {
  const project = loadProject();
  selectPlatforms(project, { android: true });
  for (const [flag, value] of [['--from', opts.from], ['--to', opts.to]]) {
    if (!ANDROID_TRACKS.includes(value)) throw new AppshipError(`${flag} must be one of ${ANDROID_TRACKS.join(', ')}`);
  }
  const context = androidContext(project, { rollout: parseRollout(opts.rollout), android: { from_track: opts.from, to_track: opts.to, version_code: opts.versionCode } });
  await confirmAction(`Promote Android "${opts.from}" → "${opts.to}"${context.android.rollout ? ` at ${context.android.rollout * 100}%` : ''}?`, opts);
  runLane(project, 'android', 'promote', context, opts);
}

export async function statusCommand(opts) {
  const project = loadProject();
  for (const platform of selectPlatforms(project, opts)) {
    const context = platform === 'ios' ? iosContext(project) : androidContext(project);
    runLane(project, platform, 'status', context, opts);
  }
}

export function checklistMarkdown(project, platforms) {
  const lines = [
    `# First release checklist — ${project.config.app.name}`,
    '',
    `Generated by \`appship checklist\` on ${new Date().toISOString().slice(0, 10)} from release/questionnaire.yml. Re-run after changing answers.`,
    '',
  ];
  if (platforms.includes('ios')) lines.push(...iosManualChecklist(project.config, project.questionnaire.ios), '');
  if (platforms.includes('android')) lines.push(...androidManualChecklist(project.config, project.questionnaire.android), '');
  return lines.join('\n');
}

export async function checklistCommand(opts) {
  const project = loadProject();
  const md = checklistMarkdown(project, selectPlatforms(project, opts));
  const file = path.join(project.releaseDir, 'CHECKLIST.md');
  fs.writeFileSync(file, md);
  log.info(md);
  log.ok(`Saved to ${path.relative(project.root, file)}`);
}

export async function firstReleaseCommand(opts) {
  const project = loadProject();
  const platforms = selectPlatforms(project, opts);

  if (platforms.includes('ios')) {
    log.step('iOS first release');
    assertQuestionnaire(project, 'ios', opts);
    if (opts.createApp) {
      await confirmAction(`Create "${project.config.app.name}" (${project.config.ios.bundle_id}) in App Store Connect?`, opts);
      runLane(project, 'ios', 'create_app', iosContext(project, { skipApiKey: true }), opts);
    } else {
      log.hint('Skipping app creation (pass --create-app, or create it in App Store Connect → Apps → + New App).');
    }
    await metadataCommand('push', { ...opts, ios: true, android: false });
    const ctx = iosContext(project);
    if (ctx.ios.apple_id && !opts.skipPrivacy) runLane(project, 'ios', 'privacy', ctx, opts);
    else log.warn('App Privacy not uploaded (needs credentials.ios.apple_id) — answer it by hand, see CHECKLIST.md');
  }

  if (platforms.includes('android')) {
    log.step('Android first release');
    assertQuestionnaire(project, 'android', opts);
    log.info('  Google Play cannot create apps or upload the very first bundle via API.');
    log.info('  Follow release/CHECKLIST.md, then run: appship metadata --android && appship upload --android');
  }

  await checklistCommand({ ...opts, ...Object.fromEntries(platforms.map((p) => [p, true])) });
}

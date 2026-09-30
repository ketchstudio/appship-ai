import fs from 'node:fs';
import path from 'node:path';
import { checkbox, confirm, input, select } from '@inquirer/prompts';
import { AppshipError, log } from '../log.js';
import { CONFIG_FILE, KEYS_DIR, QUESTIONNAIRE_FILE, RELEASE_DIR, SKILLS_DIR, TEMPLATES_DIR, WORK_DIR } from '../paths.js';
import { listProfiles } from '../credentials.js';
import { FRAMEWORKS, detectAndroidPackage, detectAppName, detectFramework, detectIosBundleId } from '../detect.js';
import { androidTemplates, iosTemplates, writeFiles } from '../metadata.js';
import { LOCALE_PRESET, parsePresetIds, presetLocales } from '../locales.js';

const GITIGNORE_BLOCK = [
  '# appship — never commit store keys or generated files',
  `${RELEASE_DIR}/${KEYS_DIR}/*`,
  `!${RELEASE_DIR}/${KEYS_DIR}/README.md`,
  `${RELEASE_DIR}/${WORK_DIR}/`,
];

const KEYS_README = `# release/keys

Put store credentials for this project here **only if** you do not use a profile
(\`appship credentials add\`) or CI environment variables.

Everything in this folder except this README is gitignored. \`appship doctor\` fails if a key
is ever tracked by git.

Typical files:

- \`AuthKey_XXXXXXXXXX.p8\` — App Store Connect API key
- \`play-service-account.json\` — Google Play service account key
`;

/** Locale folders for a platform: the primary locale plus the chosen preset languages, without duplicates. */
function platformLocales(a, platform) {
  return [...new Set([a.locale, ...presetLocales(platform, a.presetIds)])];
}

function iosBlock(a) {
  if (!a.platforms.includes('ios')) return '# ios: (not configured — run "appship init --force" to add)\n';
  const fw = FRAMEWORKS[a.framework].ios;
  return `ios:
  bundle_id: ${a.iosBundleId}
  # team_id: ABCDE12345                     # Developer Portal team (only if your Apple ID has several)
  # sku: ${a.iosBundleId}                   # defaults to bundle_id
  # version: "1.0.0"                        # App Store version to edit/submit; default = the editable one
  artifact: "${fw.artifact}"
  build_command: "${fw.build_command}"
${
    a.presetIds.length
      ? `  locales: [${platformLocales(a, 'ios').join(', ')}]   # store languages = folders in metadata_path (iOS codes)`
      : `  # locales: [${a.locale}, es-ES, es-MX, pt-BR, de-DE, fr-FR, ja, ko]   # store languages = folders in metadata_path; iOS codes, see docs/configuration.md`
  }
  # signing:                               # sign from files the account owner gave you; see docs/signing.md
  #   style: manual                         # automatic (Xcode signs, default) | manual (files below)
  #   certificate: release/keys/AppleDistribution.p12
  #   profiles: [release/keys/AppStore.mobileprovision]
  upload_screenshots: true
  submit:
    automatic_release: false              # release as soon as Apple approves
    phased_release: false                 # 7-day phased rollout
    reset_ratings: false
`;
}

function androidBlock(a) {
  if (!a.platforms.includes('android')) return '# android: (not configured — run "appship init --force" to add)\n';
  const fw = FRAMEWORKS[a.framework].android;
  return `android:
  package_name: ${a.androidPackage}
  artifact: "${fw.artifact}"
  build_command: "${fw.build_command}"
  track: internal                         # internal | alpha (closed) | beta (open) | production
  release_status: completed               # completed | draft (draft is required while the app is unpublished)
  rollout: 1                              # 0.2 = 20% staged rollout (production)
${
    a.presetIds.length
      ? `  locales: [${platformLocales(a, 'android').join(', ')}]   # Play codes differ from iOS; enable each language in Play Console first`
      : `  # locales: [${a.locale}, es-ES, es-419, pt-BR, de-DE, fr-FR, ja-JP, ko-KR]   # Play codes differ from iOS (ja-JP vs ja); enable them in Play Console first`
  }
  upload_screenshots: true
`;
}

function credentialsBlock(a) {
  if (a.profile) return `  profile: ${a.profile}\n`;
  const lines = ['  # profile: my-company'];
  if (a.platforms.includes('ios')) {
    lines.push(
      '  ios:',
      '    key_id: TODO',
      '    issuer_id: TODO',
      `    key_path: ${RELEASE_DIR}/${KEYS_DIR}/AuthKey_TODO.p8`,
      '    # apple_id: you@example.com          # only for creating the app and App Privacy upload',
    );
  }
  if (a.platforms.includes('android')) {
    lines.push('  android:', `    json_key_path: ${RELEASE_DIR}/${KEYS_DIR}/play-service-account.json`);
  }
  return `${lines.join('\n')}\n`;
}

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

/** Copy the bundled Claude Code skills into <project>/.claude/skills/. Existing skills are left alone. */
export function installSkills(root) {
  const installed = [];
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dest = path.join(root, '.claude', 'skills', entry.name);
    if (fs.existsSync(dest)) continue;
    fs.cpSync(path.join(SKILLS_DIR, entry.name), dest, { recursive: true });
    installed.push(entry.name);
  }
  return installed;
}

export function ensureGitignore(root) {
  const file = path.join(root, '.gitignore');
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  const existing = new Set(current.split('\n').map((l) => l.trim()));
  const missing = GITIGNORE_BLOCK.filter((l) => !existing.has(l));
  if (missing.length <= 1 && missing.every((l) => l.startsWith('#'))) return false;
  const prefix = current && !current.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(file, `${prefix}\n${GITIGNORE_BLOCK.join('\n')}\n`);
  return true;
}

async function gather(root, opts) {
  const detected = {
    framework: detectFramework(root),
    name: detectAppName(root),
    iosBundleId: detectIosBundleId(root),
    androidPackage: detectAndroidPackage(root),
  };
  const interactive = !opts.yes && process.stdin.isTTY;
  const profiles = listProfiles().map((p) => p.name);

  const a = {
    name: opts.name ?? detected.name,
    framework: opts.framework ?? detected.framework,
    platforms: opts.platforms ? opts.platforms.split(',').map((s) => s.trim()) : ['ios', 'android'],
    iosBundleId: opts.bundleId ?? detected.iosBundleId,
    androidPackage: opts.packageName ?? detected.androidPackage,
    locale: opts.locale ?? 'en-US',
    profile: opts.profile ?? null,
    presetIds: opts.locales ? parsePresetIds(opts.locales) : [],
  };

  if (interactive) {
    a.name = await input({ message: 'App name (as shown on the store):', default: a.name });
    a.framework = await select({
      message: `Project type (detected: ${FRAMEWORKS[detected.framework].label}):`,
      default: a.framework,
      choices: Object.entries(FRAMEWORKS).map(([value, f]) => ({ value, name: f.label })),
    });
    a.platforms = await checkbox({
      message: 'Platforms:',
      choices: [
        { value: 'ios', name: 'iOS (App Store)', checked: a.platforms.includes('ios') },
        { value: 'android', name: 'Android (Google Play)', checked: a.platforms.includes('android') },
      ],
      required: true,
    });
    if (a.platforms.includes('ios')) a.iosBundleId = await input({ message: 'iOS bundle id:', default: a.iosBundleId ?? undefined, required: true });
    if (a.platforms.includes('android')) a.androidPackage = await input({ message: 'Android package name:', default: a.androidPackage ?? undefined, required: true });
    a.locale = await input({ message: 'Primary store locale:', default: a.locale });
    if (!opts.locales) {
      a.presetIds = await checkbox({
        message: 'Also create store listings for popular markets? (space to select, enter to skip)',
        choices: LOCALE_PRESET.map((p) => ({ value: p.id, name: `${p.name} (${p.ios.join(', ')})` })),
      });
    }
    if (profiles.length) {
      const choice = await select({
        message: 'Credentials:',
        choices: [
          ...profiles.map((p) => ({ value: p, name: `Use profile "${p}"` })),
          { value: '', name: 'Key files inside this project (release/keys/)' },
        ],
      });
      a.profile = choice || null;
    } else {
      log.dim('  No credential profiles yet — key paths will point to release/keys/. (appship credentials add <name> to create one)');
    }
  }

  if (a.platforms.includes('ios') && !a.iosBundleId) throw new AppshipError('iOS bundle id not detected — pass --bundle-id');
  if (a.platforms.includes('android') && !a.androidPackage) throw new AppshipError('Android package not detected — pass --package-name');
  if (!FRAMEWORKS[a.framework]) throw new AppshipError(`Unknown framework "${a.framework}". Use one of: ${Object.keys(FRAMEWORKS).join(', ')}`);
  return a;
}

export async function initCommand(opts) {
  const root = path.resolve(opts.dir ?? process.cwd());
  const releaseDir = path.join(root, RELEASE_DIR);
  const configPath = path.join(releaseDir, CONFIG_FILE);

  if (fs.existsSync(configPath) && !opts.force) {
    throw new AppshipError(`${path.relative(root, configPath)} already exists. Use --force to regenerate it (metadata files are kept).`);
  }
  if (fs.existsSync(configPath) && opts.force && !opts.yes && process.stdin.isTTY) {
    if (!(await confirm({ message: 'Overwrite release.yml and questionnaire.yml?', default: false }))) return;
  }

  const a = await gather(root, opts);
  log.step(`Setting up appship in ${root}`);

  fs.mkdirSync(releaseDir, { recursive: true });
  const template = fs.readFileSync(path.join(TEMPLATES_DIR, CONFIG_FILE), 'utf8');
  fs.writeFileSync(
    configPath,
    render(template, {
      APP_NAME: a.name.replace(/"/g, '\\"'),
      PRIMARY_LOCALE: a.locale,
      IOS_BLOCK: iosBlock(a),
      ANDROID_BLOCK: androidBlock(a),
      CREDENTIALS_BLOCK: credentialsBlock(a),
    }),
  );
  log.ok(`${RELEASE_DIR}/${CONFIG_FILE}`);

  const qPath = path.join(releaseDir, QUESTIONNAIRE_FILE);
  if (!fs.existsSync(qPath) || opts.force) {
    fs.copyFileSync(path.join(TEMPLATES_DIR, QUESTIONNAIRE_FILE), qPath);
    log.ok(`${RELEASE_DIR}/${QUESTIONNAIRE_FILE}`);
  }

  if (a.platforms.includes('ios')) {
    const t = iosTemplates(a.name);
    const metaDir = path.join(releaseDir, 'ios', 'metadata');
    const locales = platformLocales(a, 'ios');
    let n = writeFiles(metaDir, t.global).length;
    for (const locale of locales) {
      n += writeFiles(path.join(metaDir, locale), t.localized).length;
      fs.mkdirSync(path.join(releaseDir, 'ios', 'screenshots', locale), { recursive: true });
    }
    log.ok(`${RELEASE_DIR}/ios/metadata/{${locales.join(',')}} (${n} new files), ios/screenshots/<locale>/`);
  }
  if (a.platforms.includes('android')) {
    const locales = platformLocales(a, 'android');
    let n = 0;
    for (const locale of locales) {
      const localeDir = path.join(releaseDir, 'android', 'metadata', locale);
      n += writeFiles(localeDir, androidTemplates(a.name)).length;
      fs.mkdirSync(path.join(localeDir, 'images', 'phoneScreenshots'), { recursive: true });
    }
    log.ok(`${RELEASE_DIR}/android/metadata/{${locales.join(',')}} (${n} new files), images/phoneScreenshots/`);
  }

  const keysDir = path.join(releaseDir, KEYS_DIR);
  fs.mkdirSync(keysDir, { recursive: true });
  writeFiles(keysDir, { 'README.md': KEYS_README.trim() });
  if (ensureGitignore(root)) log.ok('.gitignore updated (release/keys/*, release/.appship/)');

  if (a.presetIds.length) {
    log.info(`  Extra languages: ${a.presetIds.join(', ')}. Replace the TODO text in their metadata folders with real translations, and enable each language in Play Console.`);
  }

  const skills = installSkills(root);
  if (skills.length) log.ok(`.claude/skills/${skills.join(', ')} (Claude Code skill: ask it to write your release notes)`);

  log.step('Next steps');
  const steps = [
    a.profile ? null : 'Add store keys: appship credentials add <profile>   (or put them in release/keys/ — see docs/credentials.md)',
    `Fill in ${RELEASE_DIR}/${QUESTIONNAIRE_FILE} and replace every TODO in ${RELEASE_DIR}/*/metadata`,
    'Add screenshots (release/ios/screenshots/<locale>/, release/android/metadata/<locale>/images/)',
    'Check everything: appship doctor',
    'First time on the stores: appship first-release',
  ].filter(Boolean);
  steps.forEach((s, i) => log.info(`  ${i + 1}. ${s}`));
}

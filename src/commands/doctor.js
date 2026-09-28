import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { log, AppshipError } from '../log.js';
import { loadProject, selectPlatforms, validateConfig } from '../config.js';
import { checkCredentialFiles, resolveCredentials } from '../credentials.js';
import { findArtifact } from '../artifacts.js';
import { fastlaneVersion } from '../fastlane.js';
import { validateAndroidMetadata, validateIosMetadata } from '../metadata.js';
import { validateAndroidQuestionnaire, validateIosQuestionnaire } from '../questionnaire.js';

const SECRET_PATTERN = /\.(p8|p12|jks|keystore|mobileprovision)$|service-account.*\.json$|release\/keys\/(?!README\.md$)/;

class Report {
  errors = 0;
  warnings = 0;
  section(title) {
    log.step(title);
  }
  ok(msg) {
    log.ok(msg);
  }
  warn(msg, hint) {
    this.warnings++;
    log.warn(msg);
    if (hint) log.hint(hint);
  }
  error(msg, hint) {
    this.errors++;
    log.fail(msg);
    if (hint) log.hint(hint);
  }
  issues(list) {
    for (const i of list) (i.level === 'error' ? this.error : this.warn).call(this, i.msg, i.hint);
  }
}

function trackedSecrets(root) {
  const res = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  if (res.status !== 0) return null; // not a git repo
  return res.stdout.split('\n').filter((f) => SECRET_PATTERN.test(f));
}

export async function doctorCommand(opts) {
  const r = new Report();

  r.section('Environment');
  const [major] = process.versions.node.split('.').map(Number);
  major >= 22 ? r.ok(`Node ${process.versions.node}`) : r.error(`Node ${process.versions.node} is too old`, 'appship needs Node 22+');
  const fl = fastlaneVersion();
  fl ? r.ok(`fastlane ${fl}`) : r.error('fastlane not found', 'Install: brew install fastlane   (or set APPSHIP_FASTLANE="bundle exec fastlane")');

  r.section('Config');
  const project = loadProject(process.cwd(), { validate: false });
  const configErrors = validateConfig(project.config);
  configErrors.length ? configErrors.forEach((e) => r.error(e)) : r.ok(`release/release.yml (${project.root})`);
  if (configErrors.length) return finish(r);
  const platforms = selectPlatforms(project, opts);

  r.section('Security');
  const secrets = trackedSecrets(project.root);
  if (secrets === null) r.warn('Not a git repository — cannot verify keys are untracked');
  else if (secrets.length) {
    secrets.forEach((f) => r.error(`Secret file tracked by git: ${f}`, `git rm --cached "${f}" and rotate the key — it is in your history.`));
  } else r.ok('No key files tracked by git');
  const gitignore = fs.existsSync(path.join(project.root, '.gitignore')) ? fs.readFileSync(path.join(project.root, '.gitignore'), 'utf8') : '';
  gitignore.includes('release/keys/*') ? r.ok('.gitignore protects release/keys/') : r.warn('.gitignore does not exclude release/keys/*', 'Run "appship init --force" or add it manually.');

  let creds;
  try {
    creds = resolveCredentials(project);
  } catch (err) {
    r.error(err.message);
  }

  for (const platform of platforms) {
    const label = platform === 'ios' ? 'iOS' : 'Android';

    r.section(`${label} · credentials${creds?.profile ? ` (profile ${creds.profile})` : ''}`);
    if (creds) {
      const problems = checkCredentialFiles(creds, platform);
      problems.forEach((p) => r.error(p, 'See docs/credentials.md'));
      if (!problems.length) {
        for (const [field, source] of Object.entries(creds[platform].sources)) r.ok(`${field} ← ${source}`);
        for (const [field, value] of Object.entries(creds[platform])) {
          if (!field.endsWith('path') || typeof value !== 'string' || !fs.existsSync(value)) continue;
          if (fs.statSync(value).mode & 0o077) r.warn(`${value} is readable by other users`, `chmod 600 "${value}"`);
        }
      }
      if (platform === 'ios' && !creds.ios.apple_id) {
        r.warn('No apple_id set', 'Only needed for "first-release --create-app" and uploading App Privacy answers.');
      }
    }

    if (!opts.skipArtifacts) {
      r.section(`${label} · artifact`);
      const artifact = findArtifact(project, platform);
      if (artifact) {
        const ageHours = (Date.now() - fs.statSync(artifact).mtimeMs) / 36e5;
        r.ok(`${path.relative(project.root, artifact)} (${ageHours < 1 ? 'built < 1h ago' : `${Math.round(ageHours)}h old`})`);
        if (ageHours > 24) r.warn('Artifact is older than 24h — rebuild before uploading?');
      } else {
        r.warn(`No file matches ${platform}.artifact "${project.config[platform].artifact}"`, `Build it: appship build --${platform}`);
      }
    }

    r.section(`${label} · store listing`);
    const cfg = project.config[platform];
    const metaOpts = { primaryLocale: project.config.app.primary_locale, checkScreenshots: !opts.skipScreenshots && cfg.upload_screenshots };
    const { issues, locales } =
      platform === 'ios'
        ? validateIosMetadata(project.resolve(cfg.metadata_path), project.resolve(cfg.screenshots_path), metaOpts)
        : validateAndroidMetadata(project.resolve(cfg.metadata_path), metaOpts);
    r.issues(issues);
    if (!issues.some((i) => i.level === 'error')) r.ok(`Metadata OK for ${locales.join(', ')}`);

    r.section(`${label} · questionnaire`);
    const q = project.questionnaire[platform];
    if (!q) r.error(`release/questionnaire.yml has no "${platform}" section`, 'Copy it from templates/questionnaire.yml (appship init --force).');
    else {
      const errs = platform === 'ios' ? validateIosQuestionnaire(q) : validateAndroidQuestionnaire(q);
      errs.forEach((e) => r.error(e));
      if (!errs.length) r.ok('All answers present');
    }
  }

  return finish(r);
}

function finish(r) {
  log.info('');
  if (r.errors) {
    log.fail(`${r.errors} error(s), ${r.warnings} warning(s)`);
    throw new AppshipError('doctor found problems', { exitCode: 1 });
  }
  log.ok(`Ready — ${r.warnings} warning(s)`);
}

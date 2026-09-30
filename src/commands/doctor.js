import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { log, AppshipError } from '../log.js';
import { loadProject, selectPlatforms, validateConfig } from '../config.js';
import { checkCredentialFiles, resolveCredentials } from '../credentials.js';
import { findArtifact } from '../artifacts.js';
import { fastlaneVersion } from '../fastlane.js';
import { presetLocales } from '../locales.js';
import { validateAndroidMetadata, validateIosMetadata } from '../metadata.js';
import { validateAndroidQuestionnaire, validateIosQuestionnaire } from '../questionnaire.js';
import { auditProfile, bundleMatches, codesignIdentities, installedCertFor, readIpaProfile, readProfileFile, signingConfig } from '../signing.js';

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

const fmtDate = (d) => (d ? d.toISOString().slice(0, 10) : 'no expiry');

/** iOS code signing: the declared certificate/profiles (ios.signing) and the profile inside the built .ipa. */
function auditIosSigning(project, r, { artifact }) {
  const ios = project.config.ios;
  const s = signingConfig(project.config);
  const identities = codesignIdentities();
  let shown = false;
  const section = () => {
    if (!shown) r.section('iOS · signing');
    shown = true;
  };

  if (s) {
    section();
    r.ok(`ios.signing: ${s.style} signing, export method ${s.method}`);
    if (ios.build_command && !ios.build_command.includes('APPSHIP_EXPORT_OPTIONS')) {
      r.warn('ios.build_command does not use $APPSHIP_EXPORT_OPTIONS, so the build will ignore ios.signing', 'e.g. flutter build ipa --release --export-options-plist="$APPSHIP_EXPORT_OPTIONS"  (see docs/signing.md)');
    }
  }

  if (s?.style === 'manual') {
    const usable = [];
    for (const rel of s.profiles) {
      const file = project.resolve(rel);
      if (!fs.existsSync(file)) {
        r.error(`Provisioning profile not found: ${rel}`, 'Ask the account owner for the App Store .mobileprovision (docs/signing.md).');
        continue;
      }
      let profile;
      try {
        profile = readProfileFile(file);
      } catch (err) {
        r.error(err.message);
        continue;
      }
      const issues = auditProfile(profile, { label: path.basename(rel), teamId: ios.team_id });
      r.issues(issues);
      if (!issues.some((i) => i.level === 'error')) r.ok(`${path.basename(rel)}: "${profile.name}" for ${profile.bundlePattern}, App Store, expires ${fmtDate(profile.expires)}`);
      usable.push(profile);
    }
    const forApp = usable.filter((p) => bundleMatches(p.bundlePattern, ios.bundle_id));
    if (usable.length && !forApp.length) {
      r.error(`No profile covers ios.bundle_id ${ios.bundle_id} (found: ${usable.map((p) => p.bundlePattern).join(', ')})`, 'The profile must be created for this exact App ID.');
    }

    if (s.certificate) {
      const p12 = project.resolve(s.certificate);
      if (!fs.existsSync(p12)) r.error(`Certificate not found: ${s.certificate}`, 'Ask the account owner to export the Apple Distribution certificate as .p12 (docs/signing.md).');
      else if (fs.statSync(p12).mode & 0o077) r.warn(`${s.certificate} is readable by other users`, `chmod 600 "${s.certificate}"`);
    }
    if (forApp.length) {
      if (identities === null) r.warn('Cannot inspect the keychain on this OS — skipping the certificate check');
      else {
        const cert = forApp.map((p) => installedCertFor(p, identities)).find(Boolean);
        if (cert) r.ok(`Signing certificate "${cert.name}" is in the keychain`);
        else {
          const names = [...new Set(forApp.flatMap((p) => p.certs.map((c) => c.name)))].join(', ') || 'unknown';
          const msg = `None of the certificates the profile allows (${names}) is installed with its private key`;
          if (s.certificate) r.warn(msg, 'Run: appship signing import');
          else r.error(msg, 'Import the .p12 (double-click it, or set ios.signing.certificate and run: appship signing import).');
        }
      }
    }
  }

  if (artifact) {
    section();
    const embedded = readIpaProfile(artifact);
    const name = path.basename(artifact);
    if (!embedded) r.warn(`${name}: could not read the embedded provisioning profile`, 'Is it a real, signed .ipa? (needs the "unzip" tool)');
    else {
      const issues = auditProfile(embedded, { label: name, teamId: ios.team_id });
      r.issues(issues);
      if (!bundleMatches(embedded.bundlePattern, ios.bundle_id)) {
        r.error(`${name} is signed for ${embedded.bundlePattern}, but ios.bundle_id is ${ios.bundle_id}`, 'Rebuild with the right profile or fix ios.bundle_id.');
      } else if (!issues.some((i) => i.level === 'error')) {
        r.ok(`${name} is signed with "${embedded.name}" (${embedded.type}, team ${embedded.teamId}, expires ${fmtDate(embedded.expires)})`);
      }
      if (s?.style === 'manual') {
        const declared = s.profiles.map((rel) => {
          try {
            return readProfileFile(project.resolve(rel)).uuid;
          } catch {
            return null;
          }
        });
        if (!declared.includes(embedded.uuid)) r.warn(`${name} was signed with a profile that is not in ios.signing.profiles`, 'Rebuild after "appship signing import", using $APPSHIP_EXPORT_OPTIONS.');
      }
    }
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
      problems.forEach((p) => r.error(p, platform === 'ios' ? 'See docs/credentials.md — not the account owner? See docs/signing.md' : 'See docs/credentials.md'));
      if (!problems.length) {
        for (const [field, source] of Object.entries(creds[platform].sources)) r.ok(`${field} ← ${source}`);
        for (const [field, value] of Object.entries(creds[platform])) {
          if (!field.endsWith('path') || typeof value !== 'string' || !fs.existsSync(value)) continue;
          if (fs.statSync(value).mode & 0o077) r.warn(`${value} is readable by other users`, `chmod 600 "${value}"`);
        }
      }
      if (platform === 'ios' && !problems.length && !creds.ios.issuer_id) {
        r.ok('No issuer_id: treated as an individual App Store Connect API key');
      }
      if (platform === 'ios' && !creds.ios.apple_id) {
        r.warn('No apple_id set', 'Only needed for "first-release --create-app" and uploading App Privacy answers.');
      }
    }

    const artifact = opts.skipArtifacts ? null : findArtifact(project, platform);
    if (!opts.skipArtifacts) {
      r.section(`${label} · artifact`);
      if (artifact) {
        const ageHours = (Date.now() - fs.statSync(artifact).mtimeMs) / 36e5;
        r.ok(`${path.relative(project.root, artifact)} (${ageHours < 1 ? 'built < 1h ago' : `${Math.round(ageHours)}h old`})`);
        if (ageHours > 24) r.warn('Artifact is older than 24h — rebuild before uploading?');
      } else {
        r.warn(`No file matches ${platform}.artifact "${project.config[platform].artifact}"`, `Build it: appship build --${platform}`);
      }
    }

    if (platform === 'ios') auditIosSigning(project, r, { artifact });

    r.section(`${label} · store listing`);
    const cfg = project.config[platform];
    const metaOpts = { primaryLocale: project.config.app.primary_locale, checkScreenshots: !opts.skipScreenshots && cfg.upload_screenshots, declaredLocales: cfg.locales };
    const { issues, locales } =
      platform === 'ios'
        ? validateIosMetadata(project.resolve(cfg.metadata_path), project.resolve(cfg.screenshots_path), metaOpts)
        : validateAndroidMetadata(project.resolve(cfg.metadata_path), metaOpts);
    r.issues(issues);
    if (!issues.some((i) => i.level === 'error')) r.ok(`Metadata OK for ${locales.join(', ')}`);
    if (locales.length === 1) {
      const codes = presetLocales(platform).join(', ');
      log.hint(`Only one store language. Popular markets to add: ${codes} (see "Store languages" in docs/configuration.md).`);
    }

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

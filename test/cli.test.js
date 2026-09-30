import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { appship, fakeFlutterProject, fakeProfile, tmpDir, FAKE_P8, FAKE_PLAY_JSON } from './helpers.js';

test('init → credentials → doctor → dry-run release on a Flutter project', () => {
  const { root, write } = fakeFlutterProject();
  const env = { APPSHIP_HOME: tmpDir() };

  // init detects framework and ids
  let r = appship(['init', '--yes', '--name', 'Word Bank'], { cwd: root, env });
  assert.equal(r.code, 0, r.out);
  const yml = fs.readFileSync(path.join(root, 'release/release.yml'), 'utf8');
  assert.match(yml, /bundle_id: com\.example\.wordbank\n/);
  assert.match(yml, /package_name: com\.example\.wordbank\n/);
  assert.match(yml, /flutter build appbundle --release/);
  assert.match(fs.readFileSync(path.join(root, '.gitignore'), 'utf8'), /release\/keys\/\*/);
  assert.ok(fs.existsSync(path.join(root, 'release/ios/metadata/en-US/description.txt')));
  assert.ok(fs.existsSync(path.join(root, 'release/android/metadata/en-US/title.txt')));
  assert.match(fs.readFileSync(path.join(root, '.claude/skills/release-notes/SKILL.md'), 'utf8'), /^---\nname: release-notes\n/);

  // second init refuses without --force
  assert.notEqual(appship(['init', '--yes'], { cwd: root, env }).code, 0);

  // profile with fake keys, referenced from release.yml
  write('keys-src/AuthKey_ABC123.p8', FAKE_P8);
  write('keys-src/play.json', FAKE_PLAY_JSON);
  r = appship(
    ['credentials', 'add', 'acme', '--asc-key', path.join(root, 'keys-src/AuthKey_ABC123.p8'), '--asc-key-id', 'ABC123', '--asc-issuer-id', 'ISS-1', '--play-json', path.join(root, 'keys-src/play.json')],
    { cwd: root, env },
  );
  assert.equal(r.code, 0, r.out);
  fs.writeFileSync(
    path.join(root, 'release/release.yml'),
    yml.replace(/credentials:[\s\S]*$/, 'credentials:\n  profile: acme\n'),
  );
  assert.match(appship(['credentials', 'list'], { cwd: root, env }).out, /acme\s+iOS key ABC123 · Google Play/);

  // doctor flags the untouched TODO placeholders and fails
  r = appship(['doctor', '--skip-artifacts'], { cwd: root, env });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /key_id ← profile acme/);
  assert.match(r.out, /description.txt still contains a TODO/);
  assert.match(r.out, /review_information.first_name still contains TODO/);

  // doctor catches a key committed to git
  write('release/keys/AuthKey_LEAK.p8', FAKE_P8);
  spawnSync('git', ['add', '-f', 'release/keys/AuthKey_LEAK.p8'], { cwd: root });
  assert.match(appship(['doctor', '--skip-artifacts'], { cwd: root, env }).out, /Secret file tracked by git: release\/keys\/AuthKey_LEAK.p8/);

  // dry-run upload resolves artifacts and credentials without calling fastlane
  write('build/app/outputs/bundle/release/app-release.aab', 'aab');
  write('build/ios/ipa/Runner.ipa', 'ipa');
  r = appship(['upload', '--dry-run', '--rollout', '20%', '--track', 'production'], { cwd: root, env });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /fastlane ios upload/);
  assert.match(r.out, /fastlane android upload/);
  assert.match(r.out, /"release_status": "inProgress"/);
  assert.match(r.out, /"rollout": 0.2/);
  assert.match(r.out, /"key_filepath": ".*credentials\/acme\/AuthKey.p8"/);

  // checklist renders the Android answers
  r = appship(['checklist', '--android'], { cwd: root, env });
  assert.equal(r.code, 0, r.out);
  assert.match(fs.readFileSync(path.join(root, 'release/CHECKLIST.md'), 'utf8'), /Contains ads → No/);
});

test('submit refuses in non-interactive mode without --yes', () => {
  const { root, write } = fakeFlutterProject();
  const env = { APPSHIP_HOME: tmpDir(), APPSHIP_PLAY_JSON: FAKE_PLAY_JSON };
  appship(['init', '--yes', '--platforms', 'android'], { cwd: root, env });
  write('release/questionnaire.yml', 'android:\n  contains_ads: false\n  target_audience: { age_groups: ["18+"] }\n  data_safety: { collects_data: false }\n');
  const r = appship(['submit', '--android'], { cwd: root, env });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /pass --yes/);
});

function signingProject(signingYaml) {
  const project = fakeFlutterProject();
  const env = { APPSHIP_HOME: tmpDir(), APPSHIP_P12_PASSWORD: '', HOME: tmpDir() };
  assert.equal(appship(['init', '--yes', '--platforms', 'ios'], { cwd: project.root, env }).code, 0);
  const file = path.join(project.root, 'release/release.yml');
  const yml = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, yml.replace('  upload_screenshots: true\n  submit:', `${signingYaml}  upload_screenshots: true\n  submit:`));
  return { ...project, env };
}

test('doctor audits ios.signing: profile problems, missing certificate, unset export options', () => {
  const { root, write, env } = signingProject('  signing:\n    style: manual\n    profiles: [release/keys/AppStore.mobileprovision, release/keys/Dev.mobileprovision, release/keys/Missing.mobileprovision]\n');
  write('release/keys/AppStore.mobileprovision', fakeProfile({ name: 'Wordbank AppStore', expires: new Date(Date.now() + 5 * 864e5) }));
  write('release/keys/Dev.mobileprovision', fakeProfile({ name: 'Wordbank Dev', uuid: 'DEV-UUID', devices: ['d1'], getTaskAllow: true }));

  const r = appship(['doctor', '--skip-artifacts'], { cwd: root, env });
  assert.equal(r.code, 1, r.out);
  assert.match(r.out, /iOS · signing/);
  assert.match(r.out, /ios.signing: manual signing, export method app-store-connect/);
  assert.match(r.out, /does not use \$APPSHIP_EXPORT_OPTIONS/);
  assert.match(r.out, /AppStore.mobileprovision: profile "Wordbank AppStore" expires in 4 day/);
  assert.match(r.out, /Dev.mobileprovision: this is a development profile/);
  assert.match(r.out, /Provisioning profile not found: release\/keys\/Missing.mobileprovision/);
});

test('doctor: a profile for another bundle id is an error; wildcard profile and issuer-less key are fine', () => {
  const { root, write, env } = signingProject('  signing:\n    style: manual\n    profiles: [release/keys/Other.mobileprovision]\n');
  write('release/keys/Other.mobileprovision', fakeProfile({ bundle: 'com.other.app' }));
  assert.match(appship(['doctor', '--skip-artifacts'], { cwd: root, env }).out, /No profile covers ios.bundle_id com.example.wordbank \(found: com.other.app\)/);

  write('release/keys/Other.mobileprovision', fakeProfile({ bundle: 'com.example.*' }));
  write('release/keys/AuthKey_IND1.p8', FAKE_P8);
  const ymlFile = path.join(root, 'release/release.yml');
  fs.writeFileSync(ymlFile, fs.readFileSync(ymlFile, 'utf8').replace(/^    (key_id|issuer_id|key_path): .*TODO.*\n/gm, ''));
  const keyEnv = { ...env, APPSHIP_ASC_KEY_ID: 'IND1', APPSHIP_ASC_KEY_PATH: path.join(root, 'release/keys/AuthKey_IND1.p8') };
  const out = appship(['doctor', '--skip-artifacts'], { cwd: root, env: keyEnv }).out;
  assert.doesNotMatch(out, /No profile covers/);
  assert.match(out, /Other.mobileprovision: "MyApp AppStore" for com.example.\*, App Store/);
  assert.match(out, /No issuer_id: treated as an individual App Store Connect API key/);
});

test('signing export-options writes ExportOptions.plist; import --dry-run touches nothing', () => {
  const { root, write, env } = signingProject('  signing:\n    style: manual\n    profiles: [release/keys/AppStore.mobileprovision]\n');
  write('release/keys/AppStore.mobileprovision', fakeProfile({ name: 'Wordbank AppStore' }));

  let r = appship(['signing', 'export-options'], { cwd: root, env });
  assert.equal(r.code, 0, r.out);
  const plist = fs.readFileSync(path.join(root, 'release/.appship/ExportOptions.plist'), 'utf8');
  assert.match(plist, /<key>method<\/key>\s*<string>app-store-connect<\/string>/);
  assert.match(plist, /<key>com.example.wordbank<\/key>\s*<string>Wordbank AppStore<\/string>/);
  assert.match(plist, /<key>teamID<\/key>\s*<string>ABCDE12345<\/string>/);

  r = appship(['signing', 'import', '--dry-run'], { cwd: root, env });
  assert.equal(r.code, 0, r.out);
  assert.match(r.out, /\[dry-run\] copy release\/keys\/AppStore.mobileprovision/);
  const dirs = ['Library/Developer/Xcode/UserData/Provisioning Profiles', 'Library/MobileDevice/Provisioning Profiles'];
  assert.ok(dirs.every((d) => !fs.existsSync(path.join(env.HOME, d))));

  r = appship(['signing', 'import'], { cwd: root, env });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /pass --yes/);
});

test('signing commands need an ios.signing block', () => {
  const { root, env } = signingProject('');
  const r = appship(['signing', 'export-options'], { cwd: root, env });
  assert.notEqual(r.code, 0);
  assert.match(r.out, /No ios.signing block/);
});

test('init --locales creates preset languages per platform with the right codes', () => {
  const { root } = fakeFlutterProject();
  const env = { APPSHIP_HOME: tmpDir() };
  const r = appship(['init', '--yes', '--name', 'Demo', '--locales', 'es,ja'], { cwd: root, env });
  assert.equal(r.code, 0, r.out);
  const yml = fs.readFileSync(path.join(root, 'release/release.yml'), 'utf8');
  assert.match(yml, /^ {2}locales: \[en-US, es-ES, es-MX, ja\]/m);
  assert.match(yml, /^ {2}locales: \[en-US, es-ES, es-419, ja-JP\]/m);
  for (const l of ['en-US', 'es-ES', 'es-MX', 'ja']) assert.ok(fs.existsSync(path.join(root, 'release/ios/metadata', l, 'description.txt')), `ios ${l}`);
  for (const l of ['en-US', 'es-ES', 'es-419', 'ja-JP']) assert.ok(fs.existsSync(path.join(root, 'release/android/metadata', l, 'title.txt')), `android ${l}`);
  assert.ok(!fs.existsSync(path.join(root, 'release/ios/metadata/ko')));
  // the generated config is valid: doctor reports TODOs but no locale problem
  const d = appship(['doctor', '--skip-artifacts', '--skip-screenshots'], { cwd: root, env });
  assert.doesNotMatch(d.out, /not a valid App Store locale|not a Google Play language code|locales lists/);
  assert.doesNotMatch(d.out, /Only one store language/);
});

test('init --locales rejects unknown languages; default init suggests the preset', () => {
  const { root } = fakeFlutterProject();
  const env = { APPSHIP_HOME: tmpDir() };
  const bad = appship(['init', '--yes', '--locales', 'es,xx'], { cwd: root, env });
  assert.notEqual(bad.code, 0);
  assert.match(bad.out, /Unknown language "xx"/);
  assert.equal(appship(['init', '--yes', '--name', 'Demo'], { cwd: root, env }).code, 0);
  const yml = fs.readFileSync(path.join(root, 'release/release.yml'), 'utf8');
  assert.match(yml, /# locales: \[en-US, es-ES, es-MX, pt-BR, de-DE, fr-FR, ja, ko\]/);
  assert.match(yml, /# locales: \[en-US, es-ES, es-419, pt-BR, de-DE, fr-FR, ja-JP, ko-KR\]/);
  const d = appship(['doctor', '--skip-artifacts', '--skip-screenshots'], { cwd: root, env });
  assert.match(d.out, /Only one store language\. Popular markets to add: es-ES, es-MX, pt-BR/);
});

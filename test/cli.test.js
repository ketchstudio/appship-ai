import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { appship, fakeFlutterProject, tmpDir, FAKE_P8, FAKE_PLAY_JSON } from './helpers.js';

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

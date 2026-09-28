import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeConfig, validateConfig } from '../src/config.js';
import { parseRollout } from '../src/commands/release.js';
import { iosPrivacyDetails, iosSubmissionInformation, validateIosQuestionnaire, findTodos } from '../src/questionnaire.js';
import { validateAndroidMetadata, pngSize } from '../src/metadata.js';
import { resolveCredentials } from '../src/credentials.js';
import { tmpDir, pngBuffer } from './helpers.js';

test('parseRollout accepts percent and fraction', () => {
  assert.equal(parseRollout('20%'), 0.2);
  assert.equal(parseRollout('20'), 0.2);
  assert.equal(parseRollout('0.5'), 0.5);
  assert.equal(parseRollout(undefined), undefined);
  assert.throws(() => parseRollout('0'));
  assert.throws(() => parseRollout('150%'));
});

test('config: platform disabled when section missing; validation catches bad values', () => {
  const config = normalizeConfig({ app: { name: 'X' }, android: { package_name: 'com.x.y', track: 'nightly' } });
  assert.equal(config.ios.enabled, false);
  assert.equal(config.android.enabled, true);
  assert.equal(config.android.release_status, 'completed');
  assert.match(validateConfig(config).join('\n'), /android.track must be one of/);
});

test('questionnaire: privacy JSON matches fastlane format', () => {
  assert.deepEqual(iosPrivacyDetails({ privacy: { collects_data: false } }), [{ data_protections: ['DATA_NOT_COLLECTED'] }]);
  const out = iosPrivacyDetails({
    privacy: {
      collects_data: true,
      data: [{ category: 'EMAIL_ADDRESS', purposes: ['APP_FUNCTIONALITY', 'ANALYTICS'], linked_to_user: true, used_for_tracking: true }],
    },
  });
  assert.deepEqual(out, [
    { category: 'EMAIL_ADDRESS', purposes: ['ANALYTICS', 'APP_FUNCTIONALITY'], data_protections: ['DATA_LINKED_TO_YOU', 'DATA_USED_TO_TRACK_YOU'] },
  ]);
});

test('questionnaire: TODOs and missing answers are reported', () => {
  assert.deepEqual(findTodos({ a: { b: 'TODO x' }, c: ['ok', 'TODO'] }), ['a.b', 'c.1']);
  const errors = validateIosQuestionnaire({ review_information: { first_name: 'TODO' } });
  assert.ok(errors.some((e) => e.includes('ios.review_information.first_name still contains TODO')));
  assert.ok(errors.some((e) => e.includes('uses_non_exempt_encryption')));
  assert.deepEqual(iosSubmissionInformation({ export_compliance: { uses_non_exempt_encryption: false } }), {
    export_compliance_uses_encryption: false,
  });
});

test('metadata: Android limits, placeholders and image sizes', () => {
  const dir = tmpDir();
  const loc = path.join(dir, 'en-US');
  fs.mkdirSync(path.join(loc, 'images', 'phoneScreenshots'), { recursive: true });
  fs.writeFileSync(path.join(loc, 'title.txt'), 'A title that is definitely longer than thirty chars');
  fs.writeFileSync(path.join(loc, 'short_description.txt'), 'TODO: pitch');
  fs.writeFileSync(path.join(loc, 'full_description.txt'), 'Fine');
  fs.writeFileSync(path.join(loc, 'images', 'icon.png'), pngBuffer(512, 512));
  fs.writeFileSync(path.join(loc, 'images', 'featureGraphic.png'), pngBuffer(1000, 500));
  fs.writeFileSync(path.join(loc, 'images', 'phoneScreenshots', '1.png'), pngBuffer(1080, 1920));

  const msgs = validateAndroidMetadata(dir, { primaryLocale: 'en-US' }).issues.map((i) => i.msg).join('\n');
  assert.match(msgs, /title.txt is \d+ characters \(max 30\)/);
  assert.match(msgs, /short_description.txt still contains a TODO/);
  assert.match(msgs, /featureGraphic.png is 1000x500, expected 1024x500/);
  assert.match(msgs, /at least 2 phone screenshots/);
  assert.doesNotMatch(msgs, /icon/);
  assert.deepEqual(pngSize(path.join(loc, 'images', 'icon.png')), { width: 512, height: 512 });
});

test('credentials: env beats release.yml beats profile', () => {
  const home = tmpDir();
  const profileDir = path.join(home, 'credentials', 'acme');
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, 'profile.yml'), 'ios:\n  key_id: FROM_PROFILE\n  issuer_id: ISS\n  key_path: AuthKey.p8\n');
  const project = {
    config: { credentials: { profile: 'acme', ios: { key_id: 'FROM_PROJECT' } } },
    resolve: (p) => path.resolve('/proj', p),
  };

  const prev = process.env.APPSHIP_HOME;
  process.env.APPSHIP_HOME = home;
  try {
    let c = resolveCredentials(project, {});
    assert.equal(c.ios.key_id, 'FROM_PROJECT');
    assert.equal(c.ios.issuer_id, 'ISS');
    assert.equal(c.ios.key_path, path.join(profileDir, 'AuthKey.p8'));
    assert.equal(c.ios.sources.issuer_id, 'profile acme');

    c = resolveCredentials(project, { APPSHIP_ASC_KEY_ID: 'FROM_ENV', APPSHIP_ASC_KEY: Buffer.from('-----BEGIN PRIVATE KEY-----\nx').toString('base64') });
    assert.equal(c.ios.key_id, 'FROM_ENV');
    assert.match(fs.readFileSync(c.ios.key_path, 'utf8'), /BEGIN PRIVATE KEY/);
    assert.equal(fs.statSync(c.ios.key_path).mode & 0o777, 0o600);
  } finally {
    if (prev === undefined) delete process.env.APPSHIP_HOME;
    else process.env.APPSHIP_HOME = prev;
  }
});

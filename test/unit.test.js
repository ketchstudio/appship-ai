import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { normalizeConfig, validateConfig } from '../src/config.js';
import { parseRollout } from '../src/commands/release.js';
import { iosPrivacyDetails, iosSubmissionInformation, validateIosQuestionnaire, findTodos } from '../src/questionnaire.js';
import { validateAndroidMetadata, validateIosMetadata, pngSize } from '../src/metadata.js';
import { checkCredentialFiles, resolveCredentials } from '../src/credentials.js';
import { auditProfile, bundleMatches, buildPlist, exportOptions, parsePlist, parseProfile, profileInstallDirs, signingConfig } from '../src/signing.js';
import { tmpDir, pngBuffer, fakeProfile, selfSignedCert, FAKE_P8 } from './helpers.js';

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

test('config: ios.locales / android.locales are validated', () => {
  const base = { app: { name: 'X' }, ios: { bundle_id: 'com.x.y' }, android: { package_name: 'com.x.y' } };
  const errors = (over) => validateConfig(normalizeConfig({ ...base, ...over })).join('\n');
  assert.equal(errors({}), '');
  assert.equal(errors({ ios: { ...base.ios, locales: ['en-US', 'vi'] }, android: { ...base.android, locales: ['en-US', 'zh-CN'] } }), '');
  assert.match(errors({ ios: { ...base.ios, locales: ['en-US', 'zh-CN'] } }), /ios.locales: "zh-CN" is not a valid App Store locale/);
  assert.match(errors({ ios: { ...base.ios, locales: ['vi'] } }), /ios.locales must include app.primary_locale \(en-US\)/);
  assert.match(errors({ android: { ...base.android, locales: 'en-US' } }), /android.locales must be a non-empty list/);
  assert.match(errors({ android: { ...base.android, locales: ['en-US', 'en-US'] } }), /android.locales has duplicates/);
});

test('metadata: declared locales vs folders, and invalid iOS folder names', () => {
  const dir = tmpDir();
  for (const locale of ['en-US', 'vi', 'zh-CN']) fs.mkdirSync(path.join(dir, locale), { recursive: true });
  const msgs = (declaredLocales) =>
    validateIosMetadata(dir, dir, { primaryLocale: 'en-US', checkScreenshots: false, declaredLocales }).issues
      .filter((i) => /locale/.test(i.msg))
      .map((i) => `${i.level}: ${i.msg}`);
  assert.deepEqual(msgs(undefined), ['error: ios/metadata/zh-CN is not a valid App Store locale']);
  const out = msgs(['en-US', 'ja']).join('\n');
  assert.match(out, /error: ios.locales lists ja but ios\/metadata\/ja does not exist/);
  assert.match(out, /warn: ios\/metadata\/vi is not listed in ios.locales/);
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

test('metadata: iOS warns for locales missing release notes when others have them', () => {
  const dir = tmpDir();
  for (const locale of ['en-US', 'vi', 'ja']) fs.mkdirSync(path.join(dir, locale), { recursive: true });
  const run = () => validateIosMetadata(dir, dir, { primaryLocale: 'en-US', checkScreenshots: false }).issues.filter((i) => i.msg.includes('release_notes'));
  assert.equal(run().length, 0);
  fs.writeFileSync(path.join(dir, 'en-US', 'release_notes.txt'), 'Bug fixes');
  const warns = run();
  assert.deepEqual(warns.map((i) => i.level), ['warn', 'warn']);
  assert.ok(warns.some((i) => i.msg.includes('/vi/')) && warns.some((i) => i.msg.includes('/ja/')));
  fs.writeFileSync(path.join(dir, 'vi', 'release_notes.txt'), 'Sua loi');
  fs.writeFileSync(path.join(dir, 'ja', 'release_notes.txt'), 'x'.repeat(4001));
  assert.match(run().map((i) => i.msg).join('\n'), /ja\/release_notes.txt is 4001 characters/);
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
  assert.deepEqual(pngSize(path.join(loc, 'images', 'icon.png')), { width: 512, height: 512, alpha: false });
});

test('metadata: screenshot ratio, count, alpha and framed files', () => {
  const dir = tmpDir();
  const images = path.join(dir, 'en-US', 'images');
  fs.mkdirSync(path.join(images, 'phoneScreenshots'), { recursive: true });
  fs.writeFileSync(path.join(images, 'icon.png'), pngBuffer(512, 512, { alpha: true }));
  fs.writeFileSync(path.join(images, 'featureGraphic.png'), pngBuffer(1024, 500, { alpha: true }));
  fs.writeFileSync(path.join(images, 'phoneScreenshots', '01.png'), pngBuffer(1080, 1920));
  fs.writeFileSync(path.join(images, 'phoneScreenshots', '02.png'), pngBuffer(1080, 2400));
  let msgs = validateAndroidMetadata(dir, { primaryLocale: 'en-US' }).issues.map((i) => i.msg).join('\n');
  assert.match(msgs, /phoneScreenshots\/02.png is 1080x2400/);
  assert.doesNotMatch(msgs, /01.png/);
  assert.match(msgs, /featureGraphic.png has an alpha channel/);
  assert.doesNotMatch(msgs, /icon/); // Play allows a 32-bit icon
  for (let i = 3; i <= 9; i++) fs.writeFileSync(path.join(images, 'phoneScreenshots', `0${i}.png`), pngBuffer(1080, 1920));
  msgs = validateAndroidMetadata(dir, { primaryLocale: 'en-US' }).issues.map((i) => i.msg).join('\n');
  assert.match(msgs, /has 9 screenshots \(Play allows at most 8\)/);

  const shots = path.join(tmpDir(), 'en-US');
  fs.mkdirSync(shots, { recursive: true });
  fs.writeFileSync(path.join(shots, '01_home.png'), pngBuffer(1320, 2868, { alpha: true }));
  fs.writeFileSync(path.join(shots, '02_quiz_framed.png'), pngBuffer(1320, 2868));
  const iosMsgs = validateIosMetadata(path.dirname(shots), path.dirname(shots), { primaryLocale: 'en-US' }).issues.map((i) => i.msg).join('\n');
  assert.match(iosMsgs, /1 PNG\(s\) have an alpha channel \(01_home.png\)/);
  assert.match(iosMsgs, /mixes \*_framed and plain files/);
  assert.doesNotMatch(iosMsgs, /no 6.9"/);
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

test('credentials: init placeholders and missing key paths in release.yml do not hide a profile', () => {
  const home = tmpDir();
  const profileDir = path.join(home, 'credentials', 'acme');
  fs.mkdirSync(profileDir, { recursive: true });
  fs.writeFileSync(path.join(profileDir, 'profile.yml'), 'ios:\n  key_id: KID\n  issuer_id: ISS\n  key_path: AuthKey.p8\nandroid:\n  json_key_path: play.json\n');
  const root = tmpDir();
  const template = {
    profile: 'acme',
    ios: { key_id: 'TODO', issuer_id: 'TODO', key_path: 'release/keys/AuthKey_TODO.p8' },
    android: { json_key_path: 'release/keys/play-service-account.json' },
  };
  const project = { config: { credentials: template }, resolve: (p) => path.resolve(root, p) };

  const prev = process.env.APPSHIP_HOME;
  process.env.APPSHIP_HOME = home;
  try {
    let c = resolveCredentials(project, {});
    assert.equal(c.ios.key_id, 'KID');
    assert.equal(c.ios.sources.key_path, 'profile acme');
    assert.equal(c.android.json_key_path, path.join(profileDir, 'play.json'));

    // With no profile to fall back on, the placeholder is still reported so the user knows what to fill in.
    c = resolveCredentials({ ...project, config: { credentials: { ios: template.ios } } }, {});
    assert.match(checkCredentialFiles(c, 'ios').join('\n'), /key_id still contains TODO/);
  } finally {
    if (prev === undefined) delete process.env.APPSHIP_HOME;
    else process.env.APPSHIP_HOME = prev;
  }
});

const iosConfig = (signing, extra = {}) => normalizeConfig({ app: { name: 'X' }, ios: { bundle_id: 'com.example.wordbank', signing, ...extra } });

test('plist: build → parse round-trips dicts, arrays, dates, booleans and escaping', () => {
  const value = { a: 'x & <y>', n: 3, t: true, f: false, list: ['p', 'q'], empty: [], d: new Date('2030-01-02T03:04:05Z'), nested: { k: 'v' } };
  assert.deepEqual(parsePlist(buildPlist(value)), value);
});

test('signing: parseProfile reads a .mobileprovision wrapped in binary noise', () => {
  const p = parseProfile(fakeProfile({ name: 'Wordbank AppStore', uuid: 'U-1' }));
  assert.equal(p.name, 'Wordbank AppStore');
  assert.equal(p.uuid, 'U-1');
  assert.equal(p.teamId, 'ABCDE12345');
  assert.equal(p.bundlePattern, 'com.example.wordbank');
  assert.equal(p.type, 'app-store');
  assert.deepEqual(p.platforms, ['iOS']);
  assert.throws(() => parseProfile(Buffer.from('not a profile')), /no embedded property list/);
});

test('signing: profile type is inferred from devices and get-task-allow', () => {
  assert.equal(parseProfile(fakeProfile({ devices: ['a'] })).type, 'ad-hoc');
  assert.equal(parseProfile(fakeProfile({ devices: ['a'], getTaskAllow: true })).type, 'development');
});

test('signing: bundleMatches handles exact, wildcard and full wildcard App IDs', () => {
  assert.ok(bundleMatches('com.x.app', 'com.x.app'));
  assert.ok(!bundleMatches('com.x.app', 'com.x.app.widget'));
  assert.ok(bundleMatches('com.x.*', 'com.x.app'));
  assert.ok(!bundleMatches('com.x.*', 'com.y.app'));
  assert.ok(bundleMatches('*', 'anything.at.all'));
});

test('signing: auditProfile flags expired, non-App-Store, wrong team, wrong platform; warns near expiry', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const audit = (opts, ctx = {}) => auditProfile(parseProfile(fakeProfile(opts)), { label: 'p', now, ...ctx });
  const days = (n) => new Date(now.getTime() + n * 864e5);

  assert.deepEqual(audit({ expires: days(200) }), []);
  assert.match(audit({ expires: days(-1) })[0].msg, /expired on 2026-05-31/);
  const soon = audit({ expires: days(10) });
  assert.equal(soon[0].level, 'warn');
  assert.match(soon[0].msg, /expires in 10 day/);
  assert.match(audit({ expires: days(200), devices: ['a'] })[0].msg, /ad-hoc profile/);
  assert.match(audit({ expires: days(200) }, { teamId: 'ZZZZZ99999' })[0].msg, /team ABCDE12345 but ios.team_id is ZZZZZ99999/);
  assert.match(audit({ expires: days(200), platform: ['macOS'] })[0].msg, /not iOS/);
});

test('signing: certificates embedded in a profile are read and checked for expiry', (t) => {
  const dir = tmpDir();
  const cert = selfSignedCert(dir);
  if (!cert) return t.skip('openssl not available');
  const profile = parseProfile(fakeProfile({ certs: [cert.der] }));
  assert.equal(profile.certs.length, 1);
  assert.match(profile.certs[0].name, /Apple Distribution: Test/);
  assert.match(profile.certs[0].sha1, /^[0-9A-F]{40}$/);
  const future = new Date(Date.now() + 60 * 864e5);
  assert.match(auditProfile(profile, { label: 'p', now: future }).map((i) => i.msg).join('\n'), /every certificate inside this profile has expired/);
});

test('config: ios.signing is validated', () => {
  const errors = (signing) => validateConfig(iosConfig(signing)).join('\n');
  assert.equal(errors(undefined), '');
  assert.equal(errors({ style: 'manual', profiles: ['a.mobileprovision'], certificate: 'a.p12' }), '');
  assert.equal(errors({}), '');
  assert.match(errors('manual'), /must be a mapping/);
  assert.match(errors({ style: 'manual' }), /needs at least one \.mobileprovision/);
  assert.match(errors({ style: 'auto' }), /style must be one of/);
  assert.match(errors({ method: 'ad-hoc' }), /method must be one of/);
  assert.match(errors({ profiles: ['a'] }), /only used with style: manual/);
  assert.match(errors({ style: 'manual', profiles: 'a' }), /must be a list/);
  assert.match(errors({ nope: 1 }), /ios.signing.nope is not a known option/);
});

test('signing: signingConfig defaults, and exportOptions for automatic and manual', () => {
  assert.equal(signingConfig(iosConfig(undefined)), null);
  assert.deepEqual(signingConfig(iosConfig({})), { style: 'automatic', method: 'app-store-connect' });
  assert.deepEqual(exportOptions(iosConfig({}, { team_id: 'T1' }), []), { method: 'app-store-connect', signingStyle: 'automatic', uploadSymbols: true, teamID: 'T1' });

  const wildcard = parseProfile(fakeProfile({ name: 'Wild', bundle: '*' }));
  const ext = parseProfile(fakeProfile({ name: 'Ext', bundle: 'com.example.wordbank.widget' }));
  const opts = exportOptions(iosConfig({ style: 'manual', profiles: ['x'] }), [wildcard, ext]);
  assert.equal(opts.signingStyle, 'manual');
  assert.equal(opts.teamID, 'ABCDE12345');
  assert.equal(opts.signingCertificate, 'Apple Distribution');
  assert.deepEqual(opts.provisioningProfiles, { 'com.example.wordbank': 'Wild', 'com.example.wordbank.widget': 'Ext' });
  assert.match(buildPlist(opts), /<key>provisioningProfiles<\/key>/);
});

test('signing: profile install dir follows the Xcode version', () => {
  assert.equal(profileInstallDirs(16).length, 1);
  assert.match(profileInstallDirs(16)[0], /Developer\/Xcode\/UserData\/Provisioning Profiles$/);
  assert.match(profileInstallDirs(15)[0], /MobileDevice\/Provisioning Profiles$/);
  assert.equal(profileInstallDirs(null).length, 2);
});

test('credentials: issuer_id is optional (individual API key)', () => {
  const dir = tmpDir();
  const key = path.join(dir, 'AuthKey_K1.p8');
  fs.writeFileSync(key, FAKE_P8);
  const creds = (ios) => ({ ios, android: {} });
  assert.deepEqual(checkCredentialFiles(creds({ key_id: 'K1', key_path: key }), 'ios'), []);
  assert.match(checkCredentialFiles(creds({ issuer_id: 'I', key_path: key }), 'ios').join('\n'), /key_id/);
});

test('locale preset: codes per platform are valid for their store', async () => {
  const { LOCALE_PRESET, ANDROID_LOCALES, presetLocales, parsePresetIds, androidCodeFor, missingPresetIds } = await import('../src/locales.js');
  const { IOS_LOCALES } = await import('../src/metadata.js');
  for (const p of LOCALE_PRESET) {
    for (const c of p.ios) assert.ok(IOS_LOCALES.includes(c), `iOS ${c}`);
    for (const c of p.android) assert.ok(ANDROID_LOCALES.includes(c), `Android ${c}`);
  }
  assert.deepEqual(presetLocales('ios', ['es', 'ja']), ['es-ES', 'es-MX', 'ja']);
  assert.deepEqual(presetLocales('android', ['es', 'ja']), ['es-ES', 'es-419', 'ja-JP']);
  assert.deepEqual(parsePresetIds('preset'), ['es', 'pt-BR', 'de', 'fr', 'ja', 'ko']);
  assert.deepEqual(parsePresetIds('ko, es'), ['es', 'ko']);
  assert.throws(() => parsePresetIds('es,xx'), /Unknown language "xx"/);
  assert.equal(androidCodeFor('ja'), 'ja-JP');
  assert.equal(androidCodeFor('es-MX'), 'es-419');
  assert.equal(androidCodeFor('zh-Hans'), 'zh-CN');
  assert.equal(androidCodeFor('nonsense'), null);
  assert.deepEqual(missingPresetIds('ios', ['en-US', 'es-MX', 'ko']), ['pt-BR', 'de', 'fr', 'ja']);
});

test('android metadata warns about iOS-style language codes', () => {
  const dir = tmpDir();
  const write = (rel, text = 'x') => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  };
  for (const l of ['en-US', 'ja', 'ko-KR', 'xx-YY']) {
    write(`${l}/title.txt`, 'T');
    write(`${l}/short_description.txt`, 'S');
    write(`${l}/full_description.txt`, 'F');
  }
  const { issues } = validateAndroidMetadata(dir, { primaryLocale: 'en-US', checkScreenshots: false });
  const invalid = issues.filter((i) => /not a Google Play language code/.test(i.msg));
  assert.equal(invalid.length, 2);
  assert.ok(invalid.every((i) => i.level === 'warn'));
  assert.match(invalid.find((i) => i.msg.includes('/ja ')).hint, /ja-JP/);
  assert.match(invalid.find((i) => i.msg.includes('xx-YY')).hint, /unknown language codes/);
});

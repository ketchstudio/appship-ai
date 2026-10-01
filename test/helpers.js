import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPlist } from '../src/signing.js';

const BIN = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'appship.js');

export function tmpDir(prefix = 'appship-test-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** A minimal Flutter-looking project with detectable ids, inside a git repo. */
export function fakeFlutterProject() {
  const root = tmpDir();
  const write = (rel, content) => {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), content);
  };
  write('pubspec.yaml', 'name: word_bank\n');
  write('android/app/build.gradle', 'android {\n  defaultConfig {\n    applicationId "com.example.wordbank"\n  }\n}\n');
  write(
    'ios/Runner.xcodeproj/project.pbxproj',
    'PRODUCT_BUNDLE_IDENTIFIER = com.example.wordbank.RunnerTests;\nPRODUCT_BUNDLE_IDENTIFIER = com.example.wordbank;\n',
  );
  spawnSync('git', ['init', '-q'], { cwd: root });
  return { root, write };
}

export function appship(args, { cwd, env = {} } = {}) {
  const res = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', ...env },
  });
  return { code: res.status, out: res.stdout + res.stderr };
}

export function pngBuffer(width, height, { alpha = false } = {}) {
  const buf = Buffer.alloc(26);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(0x0d0a1a0a, 4);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  buf[24] = 8; // bit depth
  buf[25] = alpha ? 6 : 2; // RGBA : RGB
  return buf;
}

export const FAKE_P8 = '-----BEGIN PRIVATE KEY-----\nMIGT\n-----END PRIVATE KEY-----\n';
export const FAKE_PLAY_JSON = JSON.stringify({ type: 'service_account', client_email: 'ci@x.iam.gserviceaccount.com', private_key: 'k' });

/** A .mobileprovision-shaped blob: binary noise around the XML plist, like the real CMS wrapper. */
export function fakeProfile({
  name = 'MyApp AppStore',
  uuid = '11111111-2222-3333-4444-555555555555',
  team = 'ABCDE12345',
  bundle = 'com.example.wordbank',
  expires = new Date(Date.now() + 200 * 864e5),
  devices,
  getTaskAllow = false,
  certs = [],
  platform = ['iOS'],
} = {}) {
  const dict = {
    Name: name,
    UUID: uuid,
    TeamIdentifier: [team],
    ApplicationIdentifierPrefix: [team],
    Platform: platform,
    ExpirationDate: expires,
    DeveloperCertificates: certs,
    Entitlements: { 'application-identifier': `${team}.${bundle}`, 'get-task-allow': getTaskAllow },
  };
  if (devices) dict.ProvisionedDevices = devices;
  return Buffer.concat([Buffer.from([0x30, 0x82, 0xff, 0x01, 0x80]), Buffer.from(buildPlist(dict), 'utf8'), Buffer.from([0x00, 0x9c, 0x31])]);
}

/** Self-signed certificate + .p12 via the openssl CLI; null when openssl is unavailable. */
export function selfSignedCert(dir, password = 'pw') {
  const run = (args) => spawnSync('openssl', args, { cwd: dir, encoding: 'utf8' });
  if (run(['version']).status !== 0) return null;
  const req = run(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'k.pem', '-out', 'c.pem', '-days', '30', '-subj', '/CN=Apple Distribution: Test (ABCDE12345)']);
  if (req.status !== 0) return null;
  const p12 = run(['pkcs12', '-export', '-inkey', 'k.pem', '-in', 'c.pem', '-out', 'cert.p12', '-passout', `pass:${password}`]);
  if (p12.status !== 0) return null;
  const der = run(['x509', '-in', 'c.pem', '-outform', 'DER', '-out', 'c.der']);
  if (der.status !== 0) return null;
  return { der: fs.readFileSync(path.join(dir, 'c.der')), p12: path.join(dir, 'cert.p12'), password };
}

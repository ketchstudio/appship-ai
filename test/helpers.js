import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

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

export function pngBuffer(width, height) {
  const buf = Buffer.alloc(24);
  buf.writeUInt32BE(0x89504e47, 0);
  buf.writeUInt32BE(0x0d0a1a0a, 4);
  buf.writeUInt32BE(13, 8);
  buf.write('IHDR', 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf;
}

export const FAKE_P8 = '-----BEGIN PRIVATE KEY-----\nMIGT\n-----END PRIVATE KEY-----\n';
export const FAKE_PLAY_JSON = JSON.stringify({ type: 'service_account', client_email: 'ci@x.iam.gserviceaccount.com', private_key: 'k' });

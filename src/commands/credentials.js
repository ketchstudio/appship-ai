import { input, confirm } from '@inquirer/prompts';
import { AppshipError, log } from '../log.js';
import { listProfiles, removeProfile, saveProfile } from '../credentials.js';

export async function credentialsAddCommand(name, opts) {
  const values = {
    ascKeyPath: opts.ascKey,
    ascKeyId: opts.ascKeyId,
    ascIssuerId: opts.ascIssuerId,
    appleId: opts.appleId,
    playJsonPath: opts.playJson,
  };
  const nothingGiven = Object.values(values).every((v) => !v);

  if (nothingGiven) {
    if (!process.stdin.isTTY) throw new AppshipError('Pass at least one of --asc-key, --asc-key-id, --asc-issuer-id, --apple-id, --play-json');
    log.info('Leave a field empty to skip it. Guide: docs/credentials.md\n');
    if (await confirm({ message: 'Add App Store Connect (iOS) credentials?', default: true })) {
      values.ascKeyPath = (await input({ message: 'Path to AuthKey_XXXX.p8:' })) || undefined;
      const guessedId = values.ascKeyPath?.match(/AuthKey_([A-Z0-9]+)\.p8$/)?.[1];
      values.ascKeyId = (await input({ message: 'Key ID:', default: guessedId })) || undefined;
      values.ascIssuerId = (await input({ message: 'Issuer ID (leave empty for an individual API key):' })) || undefined;
      values.appleId = (await input({ message: 'Apple ID email (optional, for creating apps / App Privacy):' })) || undefined;
    }
    if (await confirm({ message: 'Add Google Play credentials?', default: true })) {
      values.playJsonPath = (await input({ message: 'Path to service account JSON:' })) || undefined;
    }
  }

  const { dir, profile } = saveProfile(name, values);
  log.ok(`Profile "${name}" saved in ${dir}`);
  if (profile.ios) log.hint(`iOS: key_id=${profile.ios.key_id ?? '-'} issuer_id=${profile.ios.issuer_id ?? '- (individual key)'} apple_id=${profile.ios.apple_id ?? '-'}`);
  if (profile.android) log.hint('Android: service account JSON stored');
  log.info(`\nUse it in a project's release/release.yml:\n  credentials:\n    profile: ${name}`);
}

export async function credentialsListCommand() {
  const profiles = listProfiles();
  if (!profiles.length) return log.info('No profiles. Create one with: appship credentials add <name>');
  for (const p of profiles) {
    const parts = [];
    if (p.ios) parts.push(`iOS key ${p.ios.key_id ?? '?'}${p.ios.apple_id ? ` + ${p.ios.apple_id}` : ''}`);
    if (p.android) parts.push('Google Play');
    log.info(`  ${p.name.padEnd(20)} ${parts.join(' · ') || '(empty)'}`);
  }
}

export async function credentialsRemoveCommand(name, opts) {
  if (!opts.yes) {
    if (!process.stdin.isTTY) throw new AppshipError('Pass --yes to remove a profile non-interactively');
    if (!(await confirm({ message: `Delete profile "${name}" and its key copies?`, default: false }))) return;
  }
  removeProfile(name);
  log.ok(`Removed profile "${name}"`);
}

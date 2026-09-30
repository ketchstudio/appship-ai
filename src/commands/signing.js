import path from 'node:path';
import { confirm, password } from '@inquirer/prompts';
import { AppshipError, log } from '../log.js';
import { loadProject } from '../config.js';
import { importSigning, signingConfig, writeExportOptions } from '../signing.js';

function requireSigning(project) {
  if (!project.config.ios.enabled) throw new AppshipError('ios is not configured in release.yml');
  if (!signingConfig(project.config)) throw new AppshipError('No ios.signing block in release.yml. See docs/signing.md.');
}

export async function signingImportCommand(opts) {
  const project = loadProject();
  requireSigning(project);

  const s = signingConfig(project.config);
  const what = s.certificate ? 'Install the provisioning profiles and import the .p12 certificate' : 'Install the provisioning profiles';
  const target = opts.keychain ? `keychain ${opts.keychain}` : 'your default keychain';
  if (!opts.yes && !opts.dryRun) {
    if (!process.stdin.isTTY) throw new AppshipError(`${what} on this machine — pass --yes to confirm in non-interactive mode`);
    if (!(await confirm({ message: `${what} (${target})?`, default: false }))) throw new AppshipError('Cancelled', { exitCode: 130 });
  }

  let p12Password = process.env.APPSHIP_P12_PASSWORD;
  if (s.certificate && p12Password === undefined && !opts.dryRun) {
    if (!process.stdin.isTTY) throw new AppshipError('Set APPSHIP_P12_PASSWORD to the password of the .p12 file.');
    p12Password = await password({ message: `Password of ${s.certificate}:`, mask: '*' });
  }

  log.step('Signing files');
  importSigning(project, { dryRun: opts.dryRun, keychain: opts.keychain, p12Password, keychainPassword: process.env.APPSHIP_KEYCHAIN_PASSWORD });
  const file = writeExportOptions(project);
  log.ok(`${path.relative(project.root, file)} (also available to build_command as $APPSHIP_EXPORT_OPTIONS)`);
  log.hint('Next: appship doctor');
}

export async function signingExportOptionsCommand() {
  const project = loadProject();
  requireSigning(project);
  const file = writeExportOptions(project);
  log.ok(path.relative(project.root, file));
  log.hint('Use it in build_command: flutter build ipa --export-options-plist="$APPSHIP_EXPORT_OPTIONS"');
}

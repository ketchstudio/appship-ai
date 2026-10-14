import path from 'node:path';
import { confirm } from '@inquirer/prompts';
import { loadProject } from '../config.js';
import { requireCredentials } from '../context.js';
import { AppshipError, log } from '../log.js';
import { IOS_LOCALES } from '../metadata.js';
import { appleClient, findHeaderTarget, uploadHeaderImage, validateHeaderImage } from '../apple-header.js';

export async function headerCommand(opts) {
  const project = loadProject();
  if (!project.config.ios.enabled) throw new AppshipError('iOS is not configured in release.yml');
  const version = opts.appVersion || project.config.ios.version;
  if (!version) throw new AppshipError('Pass --app-version or set ios.version in release.yml');
  const locale = opts.locale || project.config.app.primary_locale;
  if (!IOS_LOCALES.includes(locale)) throw new AppshipError(`Invalid App Store locale: ${locale}`);
  const file = path.resolve(opts.file);
  const size = validateHeaderImage(file);
  const creds = requireCredentials(project, 'ios').ios;
  log.info(`  Header: ${file} (${size.width}×${size.height})`);
  log.info(`  Target: ${project.config.ios.bundle_id} ${version}, ${locale}`);
  if (opts.dryRun) return log.step('[dry-run] Upload to App Asset Library and set Product Page Header placement');
  if (!opts.yes) {
    if (!process.stdin.isTTY) throw new AppshipError('Uploading a header writes to App Store Connect — pass --yes to confirm in non-interactive mode');
    if (!(await confirm({ message: `Replace the ${locale} Product Page Header for iOS ${version}?`, default: false }))) {
      throw new AppshipError('Cancelled', { exitCode: 130 });
    }
  }
  const api = appleClient(creds);
  const target = await findHeaderTarget(api, { bundleId: project.config.ios.bundle_id, version, locale });
  const imageId = await uploadHeaderImage(api, target, file);
  log.ok(`Header placed for ${locale} on iOS ${version} (asset ${imageId}). Submit the version for review to publish it.`);
}

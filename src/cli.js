import fs from 'node:fs';
import path from 'node:path';
import { Command, Option } from 'commander';
import { PACKAGE_ROOT } from './paths.js';
import { initCommand } from './commands/init.js';
import { doctorCommand } from './commands/doctor.js';
import { signingExportOptionsCommand, signingImportCommand } from './commands/signing.js';
import { skillsAddCommand, skillsListCommand } from './commands/skills.js';
import { credentialsAddCommand, credentialsListCommand, credentialsRemoveCommand } from './commands/credentials.js';
import {
  buildCommand,
  checklistCommand,
  firstReleaseCommand,
  metadataCommand,
  promoteCommand,
  statusCommand,
  submitCommand,
  uploadCommand,
} from './commands/release.js';

const pkg = JSON.parse(fs.readFileSync(path.join(PACKAGE_ROOT, 'package.json'), 'utf8'));

const withPlatforms = (cmd) => cmd.option('--ios', 'only iOS').option('--android', 'only Android');
const withSafety = (cmd) =>
  cmd.option('-y, --yes', 'skip confirmation prompts (required in CI)').option('--dry-run', 'print what would run without calling the stores');

export function buildProgram() {
  const program = new Command()
    .name('appship')
    .description('Release Android & iOS apps to Google Play and the App Store from one config (powered by fastlane).')
    .version(pkg.version)
    .showHelpAfterError();

  program
    .command('init')
    .description('set up release/ (config, questionnaire, metadata templates) in the current project')
    .option('--name <name>', 'app name shown on the stores')
    .addOption(new Option('--framework <type>', 'project type').choices(['flutter', 'react-native', 'cocos', 'native', 'none']))
    .option('--platforms <list>', 'ios,android')
    .option('--bundle-id <id>', 'iOS bundle identifier')
    .option('--package-name <name>', 'Android package name')
    .option('--locale <code>', 'primary store locale', undefined)
    .option('--profile <name>', 'credential profile to use')
    .option('--locales <list>', 'also create store listings for popular markets: "preset" or a list of es,pt-BR,de,fr,ja,ko')
    .option('--agents <list>', 'install the bundled skills for: claude, codex, antigravity, all, or none (default: claude)')
    .option('--dir <path>', 'project directory (default: current)')
    .option('-f, --force', 'regenerate release.yml and questionnaire.yml')
    .option('-y, --yes', 'no prompts; use detected values and flags')
    .action(initCommand);

  withPlatforms(
    program
      .command('doctor')
      .description('check tools, config, keys, artifacts, metadata and questionnaire before releasing')
      .option('--skip-artifacts', 'do not look for build outputs')
      .option('--skip-screenshots', 'do not check screenshots'),
  ).action(doctorCommand);

  const credentials = program.command('credentials').description('manage credential profiles stored in ~/.appship');
  credentials
    .command('add <profile>')
    .description('create or update a profile (interactive when no flags are given)')
    .option('--asc-key <path>', 'App Store Connect API key (.p8)')
    .option('--asc-key-id <id>', 'App Store Connect key ID')
    .option('--asc-issuer-id <id>', 'App Store Connect issuer ID (omit for an individual API key)')
    .option('--apple-id <email>', 'Apple ID (only for creating apps and App Privacy)')
    .option('--play-json <path>', 'Google Play service account JSON')
    .action(credentialsAddCommand);
  credentials.command('list').description('list profiles').action(credentialsListCommand);
  credentials.command('remove <profile>').option('-y, --yes', 'no confirmation').description('delete a profile').action(credentialsRemoveCommand);

  const signing = program.command('signing').description('iOS code signing from files: import a certificate + provisioning profiles, write ExportOptions.plist');
  signing
    .command('import')
    .description('install ios.signing profiles for Xcode and import the .p12 certificate into a keychain')
    .option('--keychain <path>', 'use (and create if missing) this keychain instead of the default one; needs APPSHIP_KEYCHAIN_PASSWORD')
    .option('-y, --yes', 'no confirmation (required in CI)')
    .option('--dry-run', 'print what would run')
    .action(signingImportCommand);
  signing.command('export-options').description('write release/.appship/ExportOptions.plist from ios.signing').action(signingExportOptionsCommand);

  const skills = program
    .command('skills')
    .description('AI agent skills (Claude Code, Codex, Antigravity): release-notes, store-screenshots, app-content');
  skills
    .command('list', { isDefault: true })
    .description('show the bundled skills and whether this project has them, per agent')
    .option('--agent <list>', 'claude, codex, antigravity or all (default: all)')
    .option('--dir <path>', 'project directory (default: the one containing release/)')
    .action(skillsListCommand);
  skills
    .command('add [names...]')
    .description('copy skills into the agent skill folders (all skills when no name is given); existing ones are kept')
    .option('--agent <list>', 'claude (.claude/skills), codex and antigravity (.agents/skills), or all; default: folders that already exist, else claude')
    .option('-f, --force', 'replace skills that differ from this appship version (overwrites local edits)')
    .option('--dir <path>', 'project directory (default: the one containing release/)')
    .action(skillsAddCommand);

  withPlatforms(program.command('build').description('run the build_command from release.yml')).action(buildCommand);

  withSafety(
    withPlatforms(
      program
        .command('upload')
        .description('upload the built .ipa to TestFlight and/or the .aab to a Google Play track')
        .option('-b, --build', 'run build_command first')
        .option('--artifact <path>', 'explicit .ipa/.aab (single platform)')
        .option('--track <track>', 'Android track: internal | alpha | beta | production')
        .option('--rollout <percent>', 'Android staged rollout, e.g. 20%')
        .option('--changelog <text>', 'iOS "What to Test" for TestFlight')
        .option('--groups <names>', 'iOS: distribute to these TestFlight groups (comma separated)'),
    ),
  ).action(uploadCommand);

  withSafety(
    withPlatforms(
      program
        .command('metadata [action]')
        .description('push (default) or pull store listing text and screenshots')
        .option('--no-screenshots', 'text only')
        .option('--app-version <version>', 'iOS App Store version to edit')
        .option('-f, --force', 'push even if validation fails'),
    ),
  ).action((action, opts) => metadataCommand(action, opts));

  withSafety(
    withPlatforms(
      program
        .command('submit')
        .description('iOS: submit for App Review · Android: promote to production')
        .option('--app-version <version>', 'iOS version to submit')
        .option('--build-number <n>', 'iOS build to attach (default: latest)')
        .option('--skip-metadata', 'iOS: do not re-upload metadata')
        .option('--from <track>', 'Android: track to promote from (default: android.track)')
        .option('--version-code <n>', 'Android: version code to promote')
        .option('--rollout <percent>', 'Android staged rollout, e.g. 20%')
        .option('-f, --force', 'submit even if questionnaire/metadata validation fails'),
    ),
  ).action(submitCommand);

  withSafety(
    program
      .command('promote')
      .description('Android: move a release between tracks')
      .requiredOption('--from <track>', 'internal | alpha | beta | production')
      .requiredOption('--to <track>', 'internal | alpha | beta | production')
      .option('--rollout <percent>', 'staged rollout, e.g. 20%')
      .option('--version-code <n>', 'version code to promote'),
  ).action(promoteCommand);

  withSafety(withPlatforms(program.command('status').description('show review state and versions on each store'))).action(statusCommand);

  withSafety(
    withPlatforms(
      program
        .command('first-release')
        .description('first time on the stores: create the iOS app, push listing, App Privacy, write CHECKLIST.md')
        .option('--create-app', 'iOS: create the app record (needs apple_id, may ask for 2FA)')
        .option('--skip-privacy', 'iOS: do not upload App Privacy answers')
        .option('--no-screenshots', 'text only')
        .option('-f, --force', 'continue even if validation fails'),
    ),
  ).action(firstReleaseCommand);

  withPlatforms(
    program.command('checklist').description('write release/CHECKLIST.md with the manual store steps and your answers'),
  ).action(checklistCommand);

  return program;
}

export async function run(argv) {
  await buildProgram().parseAsync(argv);
}

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AppshipError, log } from './log.js';
import { FASTFILE_SOURCE } from './paths.js';

/** Command used to invoke fastlane; override with APPSHIP_FASTLANE="bundle exec fastlane". */
export function fastlaneCommand() {
  return (process.env.APPSHIP_FASTLANE || 'fastlane').split(/\s+/);
}

export function fastlaneVersion() {
  const [cmd, ...args] = fastlaneCommand();
  const res = spawnSync(cmd, [...args, '--version'], { encoding: 'utf8', env: fastlaneEnv() });
  if (res.status !== 0) return null;
  return res.stdout.match(/fastlane (\d+\.\d+\.\d+)/)?.[1] ?? null;
}

function fastlaneEnv(extra = {}) {
  return {
    ...process.env,
    FASTLANE_SKIP_UPDATE_CHECK: '1',
    FASTLANE_HIDE_CHANGELOG: '1',
    FASTLANE_HIDE_TIMESTAMP: '1',
    FASTLANE_OPT_OUT_USAGE: '1',
    LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
    LANG: process.env.LANG || 'en_US.UTF-8',
    ...extra,
  };
}

/**
 * Prepare an isolated fastlane workspace at release/.appship/fastlane-run with the bundled Fastfile.
 * Projects never carry their own Fastfile, so updating appship updates every project.
 */
function prepareWorkspace(project) {
  const dir = path.join(project.workDir, 'fastlane-run');
  fs.mkdirSync(path.join(dir, 'fastlane'), { recursive: true });
  fs.copyFileSync(FASTFILE_SOURCE, path.join(dir, 'fastlane', 'Fastfile'));
  return dir;
}

function writePrivateJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  return file;
}

/**
 * Run `fastlane <platform> <lane>` with a JSON context. The context may contain the reviewer demo
 * password, so it is written 0600 and deleted as soon as the lane finishes.
 */
export function runLane(project, platform, lane, context, { dryRun = false } = {}) {
  const cwd = prepareWorkspace(project);
  const contextFile = path.join(cwd, 'context.json');
  const [cmd, ...baseArgs] = fastlaneCommand();
  const args = [...baseArgs, platform, lane];

  if (dryRun) {
    log.step(`[dry-run] ${cmd} ${args.join(' ')}`);
    log.dim(JSON.stringify(redact(context), null, 2));
    return;
  }

  writePrivateJson(contextFile, context);
  try {
    log.step(`fastlane ${platform} ${lane}`);
    const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: fastlaneEnv({ APPSHIP_CONTEXT: contextFile }) });
    if (res.error?.code === 'ENOENT') throw new AppshipError('fastlane not found. Install it: brew install fastlane');
    if (res.status !== 0) throw new AppshipError(`fastlane ${platform} ${lane} failed (exit ${res.status})`);
  } finally {
    fs.rmSync(contextFile, { force: true });
  }
}

/** Run a fastlane tool subcommand directly (e.g. `deliver download_metadata`). */
export function runTool(project, args, { dryRun = false } = {}) {
  const cwd = prepareWorkspace(project);
  const [cmd, ...baseArgs] = fastlaneCommand();
  const full = [...baseArgs, ...args];
  if (dryRun) return log.step(`[dry-run] ${cmd} ${full.join(' ')}`);
  log.step(`fastlane ${args.slice(0, 2).join(' ')}`);
  const res = spawnSync(cmd, full, { cwd, stdio: 'inherit', env: fastlaneEnv() });
  if (res.error?.code === 'ENOENT') throw new AppshipError('fastlane not found. Install it: brew install fastlane');
  if (res.status !== 0) throw new AppshipError(`fastlane ${args.join(' ')} failed (exit ${res.status})`);
}

/** deliver's CLI wants the App Store Connect key as a JSON file. Deleted on process exit. */
export function writeAscApiKeyJson(project, iosCreds) {
  const dir = path.join(project.workDir, 'fastlane-run');
  fs.mkdirSync(dir, { recursive: true });
  const file = writePrivateJson(path.join(dir, 'asc_api_key.json'), {
    key_id: iosCreds.key_id,
    issuer_id: iosCreds.issuer_id,
    key_filepath: iosCreds.key_path,
    in_house: false,
  });
  process.on('exit', () => fs.rmSync(file, { force: true }));
  return file;
}

function redact(obj) {
  return JSON.parse(JSON.stringify(obj, (k, v) => (/password/i.test(k) && v ? '***' : v)));
}

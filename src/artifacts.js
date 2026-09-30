import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AppshipError, log } from './log.js';
import { buildEnv } from './signing.js';

/** Resolve the configured artifact glob to the most recently modified matching file, or null. */
export function findArtifact(project, platform) {
  const pattern = project.config[platform].artifact;
  if (!pattern) return null;
  const matches = fs
    .globSync(pattern, { cwd: project.root })
    .map((p) => path.resolve(project.root, p))
    .filter((p) => fs.statSync(p).isFile())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return matches[0] ?? null;
}

export function requireArtifact(project, platform, override) {
  if (override) {
    const file = path.resolve(override);
    if (!fs.existsSync(file)) throw new AppshipError(`Artifact not found: ${file}`);
    return file;
  }
  const file = findArtifact(project, platform);
  if (!file) {
    throw new AppshipError(
      `No ${platform} artifact matches "${project.config[platform].artifact}". Build first (appship build --${platform}) or pass --artifact.`,
    );
  }
  return file;
}

export function runBuild(project, platform) {
  const command = project.config[platform].build_command;
  if (!command) throw new AppshipError(`${platform}.build_command is not set in release.yml`);
  log.step(`Building ${platform}: ${command}`);
  const res = spawnSync(command, { cwd: project.root, stdio: 'inherit', shell: true, env: { ...process.env, ...buildEnv(project, platform) } });
  if (res.status !== 0) throw new AppshipError(`${platform} build failed (exit ${res.status})`);
}

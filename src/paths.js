import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TEMPLATES_DIR = path.join(PACKAGE_ROOT, 'templates');
export const SKILLS_DIR = path.join(PACKAGE_ROOT, 'skills');
export const FASTFILE_SOURCE = path.join(PACKAGE_ROOT, 'fastlane', 'Fastfile');

export const RELEASE_DIR = 'release';
export const CONFIG_FILE = 'release.yml';
export const QUESTIONNAIRE_FILE = 'questionnaire.yml';
export const KEYS_DIR = 'keys';
// Scratch space inside the project (gitignored): generated Fastfile, lane context, checklists.
export const WORK_DIR = '.appship';

export function appshipHome() {
  return process.env.APPSHIP_HOME || path.join(os.homedir(), '.appship');
}

export function profilesDir() {
  return path.join(appshipHome(), 'credentials');
}

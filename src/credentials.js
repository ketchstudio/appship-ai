import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { AppshipError } from './log.js';
import { profilesDir } from './paths.js';

// Resolution order for every field: environment variable > release.yml `credentials` > profile.
const ENV = {
  ios: {
    key_id: 'APPSHIP_ASC_KEY_ID',
    issuer_id: 'APPSHIP_ASC_ISSUER_ID',
    key_path: 'APPSHIP_ASC_KEY_PATH',
    apple_id: 'APPSHIP_APPLE_ID',
  },
  android: {
    json_key_path: 'APPSHIP_PLAY_JSON_PATH',
  },
};
// Secrets passed as file *content* (CI), plain text or base64. Written to a private temp file.
const ENV_CONTENT = {
  ios: { key_path: { env: 'APPSHIP_ASC_KEY', file: 'AuthKey.p8' } },
  android: { json_key_path: { env: 'APPSHIP_PLAY_JSON', file: 'play-service-account.json' } },
};
const PATH_FIELDS = new Set(['key_path', 'json_key_path']);

let tempDir;
function materialize(content, fileName) {
  if (!tempDir) {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appship-'));
    process.on('exit', () => fs.rmSync(tempDir, { recursive: true, force: true }));
  }
  const looksPlain = content.includes('BEGIN PRIVATE KEY') || content.trim().startsWith('{');
  const data = looksPlain ? content : Buffer.from(content, 'base64').toString('utf8');
  const file = path.join(tempDir, fileName);
  fs.writeFileSync(file, data, { mode: 0o600 });
  return file;
}

export function profilePath(name) {
  return path.join(profilesDir(), name);
}

export function readProfile(name) {
  const file = path.join(profilePath(name), 'profile.yml');
  if (!fs.existsSync(file)) {
    throw new AppshipError(`Credential profile "${name}" not found. Create it with "appship credentials add ${name}".`);
  }
  return YAML.parse(fs.readFileSync(file, 'utf8')) ?? {};
}

export function listProfiles() {
  const dir = profilesDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'profile.yml')))
    .map((d) => ({ name: d.name, ...readProfile(d.name) }));
}

/**
 * Create or update a profile. Key files are copied into ~/.appship/credentials/<name>/ with 0600
 * permissions so projects can reference the profile by name only.
 */
export function saveProfile(name, { ascKeyPath, ascKeyId, ascIssuerId, appleId, playJsonPath }) {
  if (!/^[\w.-]+$/.test(name)) throw new AppshipError('Profile name may only contain letters, digits, ".", "_" and "-"');
  const dir = profilePath(name);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const profilePathFile = path.join(dir, 'profile.yml');
  const profile = fs.existsSync(profilePathFile) ? readProfile(name) : {};

  const copy = (src, dest) => {
    if (!fs.existsSync(src)) throw new AppshipError(`File not found: ${src}`);
    fs.copyFileSync(src, path.join(dir, dest));
    fs.chmodSync(path.join(dir, dest), 0o600);
    return dest;
  };

  if (ascKeyPath || ascKeyId || ascIssuerId || appleId) {
    profile.ios = { ...profile.ios };
    if (ascKeyPath) profile.ios.key_path = copy(ascKeyPath, 'AuthKey.p8');
    if (ascKeyId) profile.ios.key_id = ascKeyId;
    if (ascIssuerId) profile.ios.issuer_id = ascIssuerId;
    if (appleId) profile.ios.apple_id = appleId;
  }
  if (playJsonPath) profile.android = { ...profile.android, json_key_path: copy(playJsonPath, 'play-service-account.json') };

  fs.writeFileSync(profilePathFile, YAML.stringify(profile), { mode: 0o600 });
  return { dir, profile };
}

export function removeProfile(name) {
  const dir = profilePath(name);
  if (!fs.existsSync(dir)) throw new AppshipError(`Credential profile "${name}" not found`);
  fs.rmSync(dir, { recursive: true, force: true });
}

// The template's TODO values and key paths that do not exist yet must not hide a profile that has the field.
function isShadowingPlaceholder(project, value, field, profileValue) {
  if (!profileValue) return false;
  if (String(value).includes('TODO')) return true;
  return PATH_FIELDS.has(field) && !fs.existsSync(project.resolve(value));
}

/** Resolve credentials for a loaded project. Returns values plus where each came from. */
export function resolveCredentials(project, env = process.env) {
  const projectCreds = project.config.credentials ?? {};
  const profileName = env.APPSHIP_PROFILE || projectCreds.profile;
  const profile = profileName ? readProfile(profileName) : {};
  const profileDir = profileName ? profilePath(profileName) : null;

  const result = { profile: profileName ?? null };
  for (const platform of Object.keys(ENV)) {
    const values = {};
    const sources = {};
    for (const [field, envName] of Object.entries(ENV[platform])) {
      const content = ENV_CONTENT[platform][field];
      if (env[envName]) {
        values[field] = PATH_FIELDS.has(field) ? path.resolve(env[envName]) : env[envName];
        sources[field] = `env ${envName}`;
      } else if (content && env[content.env]) {
        values[field] = materialize(env[content.env], content.file);
        sources[field] = `env ${content.env}`;
      } else if (projectCreds[platform]?.[field] && !isShadowingPlaceholder(project, projectCreds[platform][field], field, profile[platform]?.[field])) {
        const v = projectCreds[platform][field];
        values[field] = PATH_FIELDS.has(field) ? project.resolve(v) : String(v);
        sources[field] = 'release.yml';
      } else if (profile[platform]?.[field]) {
        const v = profile[platform][field];
        values[field] = PATH_FIELDS.has(field) ? path.resolve(profileDir, v) : String(v);
        sources[field] = `profile ${profileName}`;
      }
    }
    result[platform] = { ...values, sources };
  }
  return result;
}

/** Light sanity checks on key files; returns a list of problems (empty = fine). */
export function checkCredentialFiles(creds, platform) {
  const problems = [];
  for (const [field, value] of Object.entries(creds[platform] ?? {})) {
    if (typeof value === 'string' && value.includes('TODO')) problems.push(`${platform}.${field} still contains TODO`);
  }
  if (problems.length) return problems;
  if (platform === 'ios') {
    const c = creds.ios;
    if (!c.key_id) problems.push('App Store Connect key_id is missing');
    if (!c.key_path) problems.push('App Store Connect .p8 key_path is missing');
    else if (!fs.existsSync(c.key_path)) problems.push(`.p8 key not found at ${c.key_path}`);
    else if (!fs.readFileSync(c.key_path, 'utf8').includes('BEGIN PRIVATE KEY')) problems.push(`${c.key_path} does not look like a .p8 private key`);
  }
  if (platform === 'android') {
    const c = creds.android;
    if (!c.json_key_path) problems.push('Google Play service account json_key_path is missing');
    else if (!fs.existsSync(c.json_key_path)) problems.push(`Service account JSON not found at ${c.json_key_path}`);
    else {
      try {
        const json = JSON.parse(fs.readFileSync(c.json_key_path, 'utf8'));
        if (json.type !== 'service_account' || !json.client_email || !json.private_key) {
          problems.push(`${c.json_key_path} is not a service account key (needs type, client_email, private_key)`);
        }
      } catch {
        problems.push(`${c.json_key_path} is not valid JSON`);
      }
    }
  }
  return problems;
}

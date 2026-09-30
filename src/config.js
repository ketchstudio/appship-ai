import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { AppshipError } from './log.js';
import { IOS_LOCALES } from './metadata.js';
import { validateSigning } from './signing.js';
import { CONFIG_FILE, QUESTIONNAIRE_FILE, RELEASE_DIR, WORK_DIR } from './paths.js';

export const PLATFORMS = ['ios', 'android'];
export const ANDROID_TRACKS = ['internal', 'alpha', 'beta', 'production'];
const ANDROID_RELEASE_STATUSES = ['draft', 'completed', 'inProgress', 'halted'];

const DEFAULTS = {
  app: { primary_locale: 'en-US' },
  ios: {
    enabled: true,
    artifact: 'build/ios/ipa/*.ipa',
    metadata_path: 'release/ios/metadata',
    screenshots_path: 'release/ios/screenshots',
    upload_screenshots: true,
    submit: { automatic_release: false, phased_release: false, reset_ratings: false },
  },
  android: {
    enabled: true,
    artifact: 'build/app/outputs/bundle/release/*.aab',
    metadata_path: 'release/android/metadata',
    upload_screenshots: true,
    track: 'internal',
    release_status: 'completed',
    rollout: 1,
  },
  credentials: {},
};

/** Walk up from `start` until a directory containing release/release.yml is found. */
export function findProjectRoot(start = process.cwd()) {
  let dir = path.resolve(start);
  for (;;) {
    if (fs.existsSync(path.join(dir, RELEASE_DIR, CONFIG_FILE))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readYaml(file) {
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8')) ?? {};
  } catch (err) {
    throw new AppshipError(`Cannot parse ${file}: ${err.message}`);
  }
}

function merge(base, override) {
  if (override === undefined || override === null) return base;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return override;
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) out[key] = merge(base[key], value);
  return out;
}

export function normalizeConfig(raw) {
  const config = { app: merge(DEFAULTS.app, raw.app), credentials: raw.credentials ?? {} };
  // A platform is active only when its section exists and is not disabled.
  for (const platform of PLATFORMS) {
    config[platform] = raw[platform] ? merge(DEFAULTS[platform], raw[platform]) : { enabled: false };
  }
  return config;
}

function validateLocales(config, platform, errors) {
  const { locales } = config[platform];
  if (locales === undefined) return;
  if (!Array.isArray(locales) || !locales.length || locales.some((l) => typeof l !== 'string' || !l)) {
    errors.push(`${platform}.locales must be a non-empty list of locale codes, e.g. [en-US, vi]`);
    return;
  }
  if (new Set(locales).size !== locales.length) errors.push(`${platform}.locales has duplicates`);
  if (platform === 'ios') {
    for (const l of locales.filter((x) => !IOS_LOCALES.includes(x))) errors.push(`ios.locales: "${l}" is not a valid App Store locale (e.g. zh-Hans, not zh-CN)`);
  }
  if (!locales.includes(config.app.primary_locale)) errors.push(`${platform}.locales must include app.primary_locale (${config.app.primary_locale})`);
}

export function validateConfig(config) {
  const errors = [];
  if (!config.app?.name) errors.push('app.name is required');

  const ios = config.ios;
  if (ios.enabled) {
    if (!ios.bundle_id) errors.push('ios.bundle_id is required');
    if (ios.bundle_id && !/^[A-Za-z0-9.-]+$/.test(ios.bundle_id)) errors.push(`ios.bundle_id "${ios.bundle_id}" is not a valid bundle identifier`);
    validateLocales(config, 'ios', errors);
    validateSigning(config, errors);
  }

  const android = config.android;
  if (android.enabled) {
    if (!android.package_name) errors.push('android.package_name is required');
    if (android.package_name && !/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)+$/.test(android.package_name)) {
      errors.push(`android.package_name "${android.package_name}" is not a valid package name`);
    }
    validateLocales(config, 'android', errors);
    if (!ANDROID_TRACKS.includes(android.track)) {
      errors.push(`android.track must be one of ${ANDROID_TRACKS.join(', ')} (got "${android.track}")`);
    }
    if (!ANDROID_RELEASE_STATUSES.includes(android.release_status)) {
      errors.push(`android.release_status must be one of ${ANDROID_RELEASE_STATUSES.join(', ')}`);
    }
    if (typeof android.rollout !== 'number' || android.rollout <= 0 || android.rollout > 1) {
      errors.push('android.rollout must be a number in (0, 1], e.g. 0.2 for 20%');
    }
  }

  if (!ios.enabled && !android.enabled) errors.push('enable at least one platform (ios or android)');
  return errors;
}

export function loadProject(cwd = process.cwd(), { validate = true } = {}) {
  const root = findProjectRoot(cwd);
  if (!root) {
    throw new AppshipError(`No ${RELEASE_DIR}/${CONFIG_FILE} found in ${cwd} or its parents. Run "appship init" first.`);
  }
  const releaseDir = path.join(root, RELEASE_DIR);
  const config = normalizeConfig(readYaml(path.join(releaseDir, CONFIG_FILE)));
  const questionnairePath = path.join(releaseDir, QUESTIONNAIRE_FILE);
  const questionnaire = fs.existsSync(questionnairePath) ? readYaml(questionnairePath) : {};

  if (validate) {
    const errors = validateConfig(config);
    if (errors.length) throw new AppshipError(`Invalid ${RELEASE_DIR}/${CONFIG_FILE}:\n  - ${errors.join('\n  - ')}`);
  }

  return {
    root,
    releaseDir,
    workDir: path.join(releaseDir, WORK_DIR),
    config,
    questionnaire,
    resolve: (p) => (p ? path.resolve(root, p) : p),
  };
}

/** Pick platforms from --ios/--android flags, defaulting to every enabled platform. */
export function selectPlatforms(project, opts = {}) {
  const requested = PLATFORMS.filter((p) => opts[p]);
  const candidates = requested.length ? requested : PLATFORMS;
  const selected = candidates.filter((p) => project.config[p].enabled);
  for (const p of requested) {
    if (!project.config[p].enabled) throw new AppshipError(`${p} is not configured in release.yml`);
  }
  return selected;
}

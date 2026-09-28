import fs from 'node:fs';
import path from 'node:path';

export const TODO = 'TODO';

// Store limits. `required` = the store rejects a listing without it.
export const IOS_LOCALIZED = {
  'name.txt': { max: 30, required: true },
  'subtitle.txt': { max: 30 },
  'description.txt': { max: 4000, required: true },
  'keywords.txt': { max: 100, required: true },
  'promotional_text.txt': { max: 170 },
  'release_notes.txt': { max: 4000 },
  'support_url.txt': { required: true, url: true },
  'marketing_url.txt': { url: true },
  'privacy_url.txt': { required: true, url: true },
};
export const IOS_GLOBAL = {
  'copyright.txt': { required: true },
  'primary_category.txt': { required: true },
  'secondary_category.txt': {},
};
export const ANDROID_LOCALIZED = {
  'title.txt': { max: 30, required: true },
  'short_description.txt': { max: 80, required: true },
  'full_description.txt': { max: 4000, required: true },
  'video.txt': { url: true },
  'changelogs/default.txt': { max: 500 },
};

// Screenshot sizes App Store Connect currently requires for iPhone (6.9" or 6.5"), either orientation.
const IOS_REQUIRED_IPHONE_SIZES = [
  [1320, 2868], [1290, 2796], [1260, 2736], [1284, 2778], [1242, 2688],
];
const IOS_SUBDIRS = new Set(['review_information', 'trade_representative_contact_information']);

export function iosTemplates(appName, year = new Date().getFullYear()) {
  return {
    localized: {
      'name.txt': appName,
      'subtitle.txt': '',
      'description.txt': `${TODO}: describe ${appName} (max 4000 characters)`,
      'keywords.txt': `${TODO}: comma,separated,keywords (max 100 characters)`,
      'promotional_text.txt': '',
      'release_notes.txt': '',
      'support_url.txt': `${TODO}: https://example.com/support`,
      'marketing_url.txt': '',
      'privacy_url.txt': `${TODO}: https://example.com/privacy`,
    },
    global: {
      'copyright.txt': `${year} ${TODO}: Company name`,
      'primary_category.txt': `${TODO}: e.g. EDUCATION, GAMES, PRODUCTIVITY (see docs/configuration.md)`,
      'secondary_category.txt': '',
    },
  };
}

export function androidTemplates(appName) {
  return {
    'title.txt': appName,
    'short_description.txt': `${TODO}: one-line pitch (max 80 characters)`,
    'full_description.txt': `${TODO}: describe ${appName} (max 4000 characters)`,
    'video.txt': '',
    'changelogs/default.txt': 'Bug fixes and improvements.',
  };
}

export function writeFiles(dir, files, { overwrite = false } = {}) {
  const written = [];
  for (const [rel, content] of Object.entries(files)) {
    const file = path.join(dir, rel);
    if (!overwrite && fs.existsSync(file)) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content ? `${content}\n` : '');
    written.push(file);
  }
  return written;
}

function listLocales(dir, skip = new Set()) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !skip.has(d.name) && !d.name.startsWith('.'))
    .map((d) => d.name);
}

function readText(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim() : '';
}

function checkFields(baseDir, rules, label, issues) {
  for (const [rel, rule] of Object.entries(rules)) {
    const value = readText(path.join(baseDir, rel));
    const where = `${label}/${rel}`;
    if (!value) {
      if (rule.required) issues.push({ level: 'error', msg: `${where} is empty`, hint: 'This field is required by the store.' });
      continue;
    }
    if (value.includes(TODO)) issues.push({ level: 'error', msg: `${where} still contains a ${TODO} placeholder` });
    // Store limits count characters, not UTF-16 units.
    const length = [...value].length;
    if (rule.max && length > rule.max) issues.push({ level: 'error', msg: `${where} is ${length} characters (max ${rule.max})` });
    if (rule.url && !value.includes(TODO) && !/^https?:\/\/\S+$/.test(value)) issues.push({ level: 'error', msg: `${where} is not a valid URL` });
  }
}

/** Read width/height from a PNG header; null for other formats. */
export function pngSize(file) {
  const fd = fs.openSync(file, 'r');
  try {
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    if (buf.readUInt32BE(0) !== 0x89504e47) return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  } finally {
    fs.closeSync(fd);
  }
}

const isImage = (f) => /\.(png|jpe?g)$/i.test(f);

export function validateIosMetadata(metadataPath, screenshotsPath, { primaryLocale, checkScreenshots = true } = {}) {
  const issues = [];
  const locales = listLocales(metadataPath, IOS_SUBDIRS);
  if (!locales.length) {
    issues.push({ level: 'error', msg: `No locale folders in ${metadataPath}`, hint: 'Run "appship init" or "appship metadata pull --ios".' });
    return { issues, locales };
  }
  if (primaryLocale && !locales.includes(primaryLocale)) issues.push({ level: 'error', msg: `Primary locale ${primaryLocale} has no metadata folder` });
  checkFields(metadataPath, IOS_GLOBAL, 'ios/metadata', issues);
  for (const locale of locales) checkFields(path.join(metadataPath, locale), IOS_LOCALIZED, `ios/metadata/${locale}`, issues);

  if (checkScreenshots) {
    for (const locale of locales) {
      const dir = path.join(screenshotsPath, locale);
      const shots = fs.existsSync(dir) ? fs.readdirSync(dir).filter(isImage) : [];
      if (!shots.length) {
        issues.push({ level: locale === primaryLocale ? 'error' : 'warn', msg: `No screenshots in ios/screenshots/${locale}` });
        continue;
      }
      const sizes = shots.map((f) => pngSize(path.join(dir, f))).filter(Boolean);
      const hasIphone = sizes.some(({ width, height }) =>
        IOS_REQUIRED_IPHONE_SIZES.some(([w, h]) => (width === w && height === h) || (width === h && height === w)),
      );
      if (sizes.length && !hasIphone) {
        issues.push({
          level: 'warn',
          msg: `ios/screenshots/${locale} has no 6.9"/6.5" iPhone screenshot`,
          hint: 'App Store Connect requires one of: 1320x2868, 1290x2796, 1284x2778, 1242x2688 (PNG/JPG).',
        });
      }
    }
  }
  return { issues, locales };
}

export function validateAndroidMetadata(metadataPath, { primaryLocale, checkScreenshots = true } = {}) {
  const issues = [];
  const locales = listLocales(metadataPath);
  if (!locales.length) {
    issues.push({ level: 'error', msg: `No locale folders in ${metadataPath}`, hint: 'Run "appship init" or "appship metadata pull --android".' });
    return { issues, locales };
  }
  if (primaryLocale && !locales.includes(primaryLocale)) issues.push({ level: 'error', msg: `Primary locale ${primaryLocale} has no metadata folder` });
  for (const locale of locales) checkFields(path.join(metadataPath, locale), ANDROID_LOCALIZED, `android/metadata/${locale}`, issues);

  if (checkScreenshots) {
    const images = path.join(metadataPath, primaryLocale ?? locales[0], 'images');
    const findImage = (base) => ['png', 'jpg', 'jpeg'].map((ext) => path.join(images, `${base}.${ext}`)).find((f) => fs.existsSync(f));
    const expect = (base, w, h) => {
      const file = findImage(base);
      if (!file) return issues.push({ level: 'error', msg: `Missing images/${base}.png (${w}x${h})`, hint: `Place it in ${images}` });
      const size = pngSize(file);
      if (size && (size.width !== w || size.height !== h)) issues.push({ level: 'error', msg: `images/${path.basename(file)} is ${size.width}x${size.height}, expected ${w}x${h}` });
    };
    expect('icon', 512, 512);
    expect('featureGraphic', 1024, 500);
    const phoneDir = path.join(images, 'phoneScreenshots');
    const phones = fs.existsSync(phoneDir) ? fs.readdirSync(phoneDir).filter(isImage) : [];
    if (phones.length < 2) issues.push({ level: 'error', msg: `Need at least 2 phone screenshots in ${path.relative(path.dirname(metadataPath), phoneDir)} (found ${phones.length})` });
  }
  return { issues, locales };
}

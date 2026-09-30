import { AppshipError } from './log.js';

// Language codes accepted by the Google Play API (fastlane supply 2.232.2, Supply::Languages::ALL_LANGUAGES, "_" → "-").
export const ANDROID_LOCALES = [
  'af', 'am', 'ar', 'az-AZ', 'be', 'bg', 'bn-BD', 'ca', 'cs-CZ', 'da-DK', 'de-DE', 'el-GR', 'en-AU', 'en-CA', 'en-GB', 'en-IN',
  'en-SG', 'en-US', 'en-ZA', 'es-419', 'es-ES', 'es-US', 'et', 'eu-ES', 'fa', 'fi-FI', 'fil', 'fr-CA', 'fr-FR', 'gl-ES', 'hi-IN',
  'hr', 'hu-HU', 'hy-AM', 'id', 'is-IS', 'it-IT', 'iw-IL', 'ja-JP', 'ka-GE', 'km-KH', 'kn-IN', 'ko-KR', 'ky-KG', 'lo-LA', 'lt',
  'lv', 'mk-MK', 'ml-IN', 'mn-MN', 'mr-IN', 'ms', 'ms-MY', 'my-MM', 'ne-NP', 'nl-NL', 'no-NO', 'pl-PL', 'pt-BR', 'pt-PT', 'rm',
  'ro', 'ru-RU', 'si-LK', 'sk', 'sl', 'sr', 'sv-SE', 'sw', 'ta-IN', 'te-IN', 'th', 'tr-TR', 'uk', 'vi', 'zh-CN', 'zh-HK', 'zh-TW', 'zu',
];

// Suggested languages for a first expansion beyond the primary locale. `cjk` = no spaces between words, so limits
// are reached with fewer visible words but the store still counts characters.
export const LOCALE_PRESET = [
  { id: 'es', name: 'Spanish', ios: ['es-ES', 'es-MX'], android: ['es-ES', 'es-419'], note: 'es-ES = Spain; es-MX (iOS) / es-419 (Play) = Latin America. Keep only the variants you will actually localize.' },
  { id: 'pt-BR', name: 'Portuguese (Brazil)', ios: ['pt-BR'], android: ['pt-BR'], note: 'Brazilian Portuguese, not European (pt-PT).' },
  { id: 'de', name: 'German', ios: ['de-DE'], android: ['de-DE'], note: 'German words are long: watch the 30-character title/subtitle limit.' },
  { id: 'fr', name: 'French', ios: ['fr-FR'], android: ['fr-FR'], note: 'Add fr-CA only if you target Canada.' },
  { id: 'ja', name: 'Japanese', ios: ['ja'], android: ['ja-JP'], cjk: true, note: 'Play code is ja-JP, iOS is ja.' },
  { id: 'ko', name: 'Korean', ios: ['ko'], android: ['ko-KR'], cjk: true, note: 'Play code is ko-KR, iOS is ko.' },
];

export const PRESET_IDS = LOCALE_PRESET.map((p) => p.id);

/** Locale folder names for a platform, in preset order. `ids` limits it to some languages. */
export function presetLocales(platform, ids = PRESET_IDS) {
  return LOCALE_PRESET.filter((p) => ids.includes(p.id)).flatMap((p) => p[platform]);
}

/** Parse `--locales preset` or `--locales es,ja` into preset ids. */
export function parsePresetIds(value) {
  const tokens = String(value).split(',').map((s) => s.trim()).filter(Boolean);
  if (tokens.includes('preset') || tokens.includes('all')) return [...PRESET_IDS];
  const unknown = tokens.filter((t) => !PRESET_IDS.includes(t));
  if (unknown.length || !tokens.length) {
    throw new AppshipError(
      `Unknown language "${unknown.join(', ')}" for --locales. Use "preset" or any of: ${PRESET_IDS.join(', ')}. ` +
        'For other languages, create the folders yourself (see docs/configuration.md).',
    );
  }
  return PRESET_IDS.filter((id) => tokens.includes(id));
}

/** Play code for a folder that looks like an iOS code (`ja` → `ja-JP`), or null when there is no obvious match. */
export function androidCodeFor(code) {
  const byIos = LOCALE_PRESET.find((p) => p.ios.includes(code));
  if (byIos) return byIos.android[byIos.ios.indexOf(code)] ?? byIos.android[0];
  if (code === 'zh-Hans') return 'zh-CN';
  if (code === 'zh-Hant') return 'zh-TW';
  const regional = ANDROID_LOCALES.filter((l) => l.startsWith(`${code}-`));
  return regional.length === 1 ? regional[0] : null;
}

/** Preset languages that a platform does not cover yet (compares by language id, e.g. any es-* covers `es`). */
export function missingPresetIds(platform, locales) {
  return LOCALE_PRESET.filter((p) => !p[platform].some((code) => locales.includes(code))).map((p) => p.id);
}

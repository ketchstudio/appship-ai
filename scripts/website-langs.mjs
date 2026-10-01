#!/usr/bin/env node
// Rewrites the language dropdown and the SEO <head> block (canonical, hreflang, robots, Open Graph,
// Twitter, JSON-LD) of every website page, and regenerates sitemap.xml and robots.txt.
// Usage: node scripts/website-langs.mjs        (run after adding a language page or editing a title/description)
// English lives at website/, every other language at website/<dir>/.
// Page <title> (docs) and <meta name="description"> are read from each page; the index <title> comes from LANGS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'website');
const PAGES = ['index.html', 'docs.html', 'license.html'];
export const BASE = 'https://appship.ketchsoft.com';
const OG_IMAGE = `${BASE}/og.png`;
const THEME_COLOR = '#0b1826';
export const LANGS = [
  { dir: '', html: 'en', og: 'en_US', label: 'English', title: 'appship — Release iOS and Android apps from one config file' },
  { dir: 'vi', html: 'vi', og: 'vi_VN', label: 'Tiếng Việt', title: 'appship — Release app iOS và Android từ một file config' },
  { dir: 'ja', html: 'ja', og: 'ja_JP', label: '日本語', title: 'appship — 1つの設定ファイルで iOS/Android アプリをリリース' },
  { dir: 'fr', html: 'fr', og: 'fr_FR', label: 'Français', title: 'appship — Publiez vos apps iOS et Android depuis un fichier' },
  { dir: 'es', html: 'es', og: 'es_ES', label: 'Español', title: 'appship — Publica apps iOS y Android desde un archivo' },
  { dir: 'pt', html: 'pt-BR', og: 'pt_BR', label: 'Português (Brasil)', title: 'appship — Publique apps iOS e Android com um só arquivo' },
  { dir: 'de', html: 'de', og: 'de_DE', label: 'Deutsch', title: 'appship — iOS- und Android-Apps aus einer Datei veröffentlichen' },
  { dir: 'ko', html: 'ko', og: 'ko_KR', label: '한국어', title: 'appship — 설정 파일 하나로 iOS·Android 앱 릴리스' },
];

const HEAD = ['<!-- langs:head -->', '<!-- /langs:head -->'];
const NAV = ['<!-- langs:nav -->', '<!-- /langs:nav -->'];

function href(from, to, page) {
  const up = from.dir ? '../' : '';
  return `${up}${to.dir ? `${to.dir}/` : ''}${page}`;
}

const ATTR = { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' };
const esc = (t) => t.replace(/[&"<>]/g, (c) => ATTR[c]);
const unesc = (t) => t.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

function absUrl(lang, page) {
  const p = page === 'index.html' ? '' : page;
  return `${BASE}/${lang.dir ? `${lang.dir}/` : ''}${p}`;
}

function readMeta(text, file) {
  const title = text.match(/<title>(.*?)<\/title>/)?.[1];
  const desc = text.match(/<meta name="description" content="(.*?)">/)?.[1];
  if (!title || !desc) throw new Error(`${file}: needs <title> and <meta name="description">`);
  return { title, desc };
}

function jsonLd(lang, page, { title, desc }) {
  const publisher = { '@type': 'Organization', name: 'Ketchsoft', url: 'https://ketchsoft.com' };
  const inPage = { url: absUrl(lang, page), inLanguage: lang.html, description: unesc(desc), publisher };
  const app = { '@type': 'SoftwareApplication', name: 'appship' };
  let data;
  if (page === 'index.html') {
    data = {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'appship',
      ...inPage,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'macOS, Linux',
      license: 'https://opensource.org/licenses/MIT',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    };
  } else if (page === 'license.html') {
    data = { '@context': 'https://schema.org', '@type': 'WebPage', name: unesc(title), ...inPage, about: { ...app, license: 'https://opensource.org/licenses/MIT' } };
  } else {
    data = { '@context': 'https://schema.org', '@type': 'TechArticle', headline: unesc(title), ...inPage, about: app };
  }
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function headBlock(from, page, meta) {
  const url = absUrl(from, page);
  const lines = [
    `<link rel="canonical" href="${url}">`,
    ...LANGS.map((l) => `<link rel="alternate" hreflang="${l.html}" href="${absUrl(l, page)}">`),
    `<link rel="alternate" hreflang="x-default" href="${absUrl(LANGS[0], page)}">`,
    '<meta name="robots" content="index, follow, max-image-preview:large">',
    `<meta name="theme-color" content="${THEME_COLOR}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:site_name" content="appship">',
    `<meta property="og:title" content="${meta.title}">`,
    `<meta property="og:description" content="${meta.desc}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:locale" content="${from.og}">`,
    ...LANGS.filter((l) => l !== from).map((l) => `<meta property="og:locale:alternate" content="${l.og}">`),
    `<meta property="og:image" content="${OG_IMAGE}">`,
    '<meta property="og:image:type" content="image/png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${esc('appship — release iOS and Android apps from one config file')}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${meta.title}">`,
    `<meta name="twitter:description" content="${meta.desc}">`,
    `<meta name="twitter:image" content="${OG_IMAGE}">`,
    `<script type="application/ld+json">${jsonLd(from, page, meta)}</script>`,
  ];
  return [`  ${HEAD[0]}`, ...lines.map((l) => `  ${l}`), `  ${HEAD[1]}`].join('\n');
}

function navBlock(from, page) {
  const current = LANGS.find((l) => l === from);
  const items = LANGS.map((l) => {
    const cur = l === from ? ' aria-current="true"' : '';
    return `        <li><a href="${href(from, l, page)}" hreflang="${l.html}" lang="${l.html}"${cur}>${l.label}</a></li>`;
  });
  return [
    `      ${NAV[0]}`,
    '      <details class="lang-menu">',
    `        <summary aria-label="Language"><span lang="${current.html}">${current.label}</span></summary>`,
    '        <ul>',
    ...items,
    '        </ul>',
    '      </details>',
    `      ${NAV[1]}`,
  ].join('\n');
}

function between(text, [open, close], block, fallback) {
  const re = new RegExp(`[ \\t]*${open}[\\s\\S]*?${close.replace('/', '\\/')}`);
  if (re.test(text)) return text.replace(re, () => block);
  return fallback(text, block);
}

let changed = 0;
for (const lang of LANGS) {
  for (const page of PAGES) {
    const file = path.join(SITE, lang.dir, page);
    if (!fs.existsSync(file)) {
      if (lang.dir === '') throw new Error(`missing ${file}`);
      console.log(`skip ${path.relative(SITE, file)} (not written yet)`);
      continue;
    }
    let text = fs.readFileSync(file, 'utf8');
    const before = text;
    // One-time migration from the single-link switcher, then idempotent marker replacement.
    text = text.replace(/^[ \t]*<a (?:class="nav-lang" )?href="[^"]*" hreflang="[^"]*" lang="[^"]*">[^<]*<\/a>\n(?=[ \t]*<\/(?:nav)>)/gm, (m) =>
      m.includes('nav-lang') ? `${NAV[0]}\n${NAV[1]}\n` : '',
    );
    text = text.replace(/^[ \t]*<a href="[^"]*" hreflang="[^"]*" lang="[^"]*">[^<]*<\/a>\n/gm, '');
    if (!text.includes(HEAD[0])) text = text.replace(/^[ \t]*<link rel="alternate" hreflang="(?:en|vi)" href="[^"]*">\n/m, `  ${HEAD[0]}\n  ${HEAD[1]}\n`);
    if (page === 'index.html') text = text.replace(/<title>.*?<\/title>/, () => `<title>${esc(lang.title)}</title>`);
    text = between(text, HEAD, headBlock(lang, page, readMeta(text, file)), () => {
      throw new Error(`${file}: no language head marker`);
    });
    text = between(text, NAV, navBlock(lang, page), () => {
      throw new Error(`${file}: no language nav marker`);
    });
    if (text !== before) {
      fs.writeFileSync(file, text);
      changed++;
    }
  }
}
const urls = [];
for (const page of PAGES) {
  for (const lang of LANGS) {
    if (!fs.existsSync(path.join(SITE, lang.dir, page))) continue;
    const alts = LANGS.filter((l) => fs.existsSync(path.join(SITE, l.dir, page)));
    const links = [...alts.map((l) => [l.html, absUrl(l, page)]), ['x-default', absUrl(LANGS[0], page)]];
    urls.push(
      [
        '  <url>',
        `    <loc>${absUrl(lang, page)}</loc>`,
        ...links.map(([code, u]) => `    <xhtml:link rel="alternate" hreflang="${code}" href="${u}"/>`),
        '  </url>',
      ].join('\n'),
    );
  }
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
const robots = `User-agent: *\nAllow: /\n\nSitemap: ${BASE}/sitemap.xml\n`;
for (const [name, body] of [['sitemap.xml', sitemap], ['robots.txt', robots]]) {
  const file = path.join(SITE, name);
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) {
    fs.writeFileSync(file, body);
    changed++;
  }
}
console.log(`${changed} file(s) updated`);

#!/usr/bin/env node
// Rewrites the language dropdown and <link rel="alternate"> tags of every website page.
// Usage: node scripts/website-langs.mjs        (run after adding or renaming a language page)
// English lives at website/, every other language at website/<dir>/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'website');
const PAGES = ['index.html', 'docs.html'];
export const LANGS = [
  { dir: '', html: 'en', label: 'English' },
  { dir: 'vi', html: 'vi', label: 'Tiếng Việt' },
  { dir: 'ja', html: 'ja', label: '日本語' },
  { dir: 'fr', html: 'fr', label: 'Français' },
  { dir: 'es', html: 'es', label: 'Español' },
  { dir: 'pt', html: 'pt-BR', label: 'Português (Brasil)' },
  { dir: 'de', html: 'de', label: 'Deutsch' },
  { dir: 'ko', html: 'ko', label: '한국어' },
];

const HEAD = ['<!-- langs:head -->', '<!-- /langs:head -->'];
const NAV = ['<!-- langs:nav -->', '<!-- /langs:nav -->'];

function href(from, to, page) {
  const up = from.dir ? '../' : '';
  return `${up}${to.dir ? `${to.dir}/` : ''}${page}`;
}

function headBlock(from, page) {
  const links = LANGS.map((l) => `  <link rel="alternate" hreflang="${l.html}" href="${href(from, l, page)}">`);
  links.push(`  <link rel="alternate" hreflang="x-default" href="${href(from, LANGS[0], page)}">`);
  return [`  ${HEAD[0]}`, ...links, `  ${HEAD[1]}`].join('\n');
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
    text = between(text, HEAD, headBlock(lang, page), () => {
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
console.log(`${changed} file(s) updated`);

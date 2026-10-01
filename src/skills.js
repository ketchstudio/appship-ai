import fs from 'node:fs';
import path from 'node:path';
import { AppshipError } from './log.js';
import { SKILLS_DIR } from './paths.js';

// Where each coding agent reads project skills (SKILL.md format is shared).
// Codex and Antigravity both scan <repo>/.agents/skills, so one copy serves both.
export const AGENTS = {
  claude: { label: 'Claude Code', dir: '.claude/skills', invoke: (n) => `/${n}` },
  codex: { label: 'Codex', dir: '.agents/skills', invoke: (n) => `$${n}` },
  antigravity: { label: 'Antigravity', dir: '.agents/skills', invoke: (n) => `"use the ${n} skill"` },
};

/** Parse "claude,codex" (or "all") into agent ids; throws on unknown names. */
export function parseAgents(list) {
  const ids = String(list)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .flatMap((s) => (s === 'all' ? Object.keys(AGENTS) : [s]));
  const unknown = ids.filter((id) => !AGENTS[id]);
  if (unknown.length) throw new AppshipError(`Unknown agent: ${unknown.join(', ')}. Use one or more of: ${Object.keys(AGENTS).join(', ')}, all`);
  if (!ids.length) throw new AppshipError('No agent given');
  return [...new Set(ids)];
}

/** Install directories (relative to the project) for the given agents, without duplicates. */
export function agentDirs(agents) {
  return [...new Set(agents.map((a) => AGENTS[a].dir))];
}

/** Agents whose skills directory already exists in the project; Claude Code when none does. */
export function detectAgents(root) {
  const found = Object.keys(AGENTS).filter((a) => fs.existsSync(path.join(root, AGENTS[a].dir)));
  return found.length ? found : ['claude'];
}

/** Read `name` and `description` from the YAML front matter of a SKILL.md. */
function frontMatter(file) {
  const match = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file, 'utf8'));
  const out = {};
  for (const line of match ? match[1].split('\n') : []) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

/** Agent skills shipped in the package, sorted by name. */
export function bundledSkills() {
  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(SKILLS_DIR, d.name, 'SKILL.md')))
    .map((d) => ({ ...frontMatter(path.join(SKILLS_DIR, d.name, 'SKILL.md')), name: d.name, dir: path.join(SKILLS_DIR, d.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function sameTree(a, b) {
  const files = (dir) =>
    fs.readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => path.relative(dir, path.join(e.parentPath, e.name)))
      .sort();
  const fa = files(a);
  const fb = files(b);
  return fa.length === fb.length && fa.every((f, i) => f === fb[i] && fs.readFileSync(path.join(a, f)).equals(fs.readFileSync(path.join(b, f))));
}

/** 'missing' | 'current' | 'changed' (differs from the bundled copy: older version or edited locally). */
export function skillState(root, skill, dir = AGENTS.claude.dir) {
  const dest = path.join(root, dir, skill.name);
  if (!fs.existsSync(dest)) return 'missing';
  return sameTree(skill.dir, dest) ? 'current' : 'changed';
}

/**
 * Copy bundled skills into each agent's skills directory. Skills that already exist are left
 * alone unless `force` is set, so local edits survive.
 * Returns project-relative paths grouped as { installed, updated, current, kept } (kept = differs, not forced).
 */
export function installSkills(root, { names, force = false, agents = ['claude'] } = {}) {
  const result = { installed: [], updated: [], current: [], kept: [] };
  for (const dir of agentDirs(agents)) {
    for (const skill of bundledSkills().filter((s) => !names?.length || names.includes(s.name))) {
      const rel = `${dir}/${skill.name}`;
      const dest = path.join(root, rel);
      const state = skillState(root, skill, dir);
      if (state === 'current' || (state === 'changed' && !force)) {
        result[state === 'current' ? 'current' : 'kept'].push(rel);
        continue;
      }
      if (state === 'changed') fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(skill.dir, dest, { recursive: true });
      result[state === 'missing' ? 'installed' : 'updated'].push(rel);
    }
  }
  return result;
}

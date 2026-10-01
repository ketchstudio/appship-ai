import path from 'node:path';
import { AppshipError, log } from '../log.js';
import { findProjectRoot } from '../config.js';
import { AGENTS, agentDirs, bundledSkills, detectAgents, installSkills, parseAgents, skillState } from '../skills.js';

// What to ask the agent once a skill is installed.
export const SKILL_USAGE = {
  'release-notes': 'write the release notes for this version',
  'store-screenshots': 'make the store screenshots',
  'app-content': 'fill in the store questionnaire (age rating, App Privacy, Data safety)',
};

function projectRoot(opts) {
  return path.resolve(opts.dir ?? findProjectRoot() ?? process.cwd());
}

function agentsFor(dir, agents) {
  return agents.filter((a) => AGENTS[a].dir === dir);
}

export function skillsListCommand(opts) {
  const root = projectRoot(opts);
  const agents = opts.agent ? parseAgents(opts.agent) : Object.keys(AGENTS);
  const label = { current: 'installed', changed: 'installed, differs from this appship version', missing: 'not installed' };
  for (const dir of agentDirs(agents)) {
    const users = agentsFor(dir, agents);
    log.step(`${users.map((a) => AGENTS[a].label).join(' + ')}: ${dir}/`);
    for (const skill of bundledSkills()) {
      const state = skillState(root, skill, dir);
      (state === 'current' ? log.ok : log.warn)(`${skill.name}  ${label[state]}`);
      if (state !== 'missing') {
        log.hint(`Run: ${users.map((a) => `${AGENTS[a].invoke(skill.name)} (${AGENTS[a].label})`).join(' · ')}, or ask: "${SKILL_USAGE[skill.name] ?? skill.name}"`);
      }
    }
  }
  log.info('\n  Install or update: appship skills add [name…] [--agent claude,codex,antigravity] [--force]');
}

export function skillsAddCommand(names, opts) {
  const root = projectRoot(opts);
  const known = bundledSkills().map((s) => s.name);
  const unknown = names.filter((n) => !known.includes(n));
  if (unknown.length) throw new AppshipError(`Unknown skill: ${unknown.join(', ')}. Available: ${known.join(', ')}`);
  const agents = opts.agent ? parseAgents(opts.agent) : detectAgents(root);
  if (!opts.agent) log.dim(`  Agents: ${agents.map((a) => AGENTS[a].label).join(', ')} (detected; choose with --agent claude,codex,antigravity)`);

  const { installed, updated, current, kept } = installSkills(root, { names, force: opts.force, agents });
  for (const rel of installed) log.ok(`${rel}`);
  for (const rel of updated) log.ok(`${rel}  updated`);
  for (const rel of current) log.dim(`  = ${rel} already up to date`);
  for (const rel of kept) log.warn(`${rel} differs from this appship version (older copy or local edits); kept. Use --force to replace it.`);
  if (installed.length || updated.length) printHowToRun(agents);
}

/** One line per agent on how to call a skill. Shared with init. */
export function printHowToRun(agents) {
  const how = {
    claude: 'Claude Code: type /release-notes, /store-screenshots or /app-content, or ask in plain words',
    codex: 'Codex: type $release-notes, $store-screenshots or $app-content, or /skills to pick one',
    antigravity: 'Antigravity: ask in the agent panel, e.g. "use the store-screenshots skill"',
  };
  for (const a of agents) log.hint(how[a]);
  log.hint('Setup per agent: docs/skills.md');
}

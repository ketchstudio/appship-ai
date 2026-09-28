import pc from 'picocolors';

export const log = {
  info: (msg) => console.log(msg),
  step: (msg) => console.log(`\n${pc.bold(pc.cyan('▸'))} ${pc.bold(msg)}`),
  ok: (msg) => console.log(`  ${pc.green('✓')} ${msg}`),
  warn: (msg) => console.log(`  ${pc.yellow('!')} ${msg}`),
  fail: (msg) => console.log(`  ${pc.red('✗')} ${msg}`),
  hint: (msg) => console.log(`    ${pc.dim(msg)}`),
  dim: (msg) => console.log(pc.dim(msg)),
};

export class AppshipError extends Error {
  constructor(message, { exitCode = 1 } = {}) {
    super(message);
    this.exitCode = exitCode;
  }
}

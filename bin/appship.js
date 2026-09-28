#!/usr/bin/env node
import { run } from '../src/cli.js';

run(process.argv).catch((err) => {
  console.error(`\n✗ ${err.message}`);
  if (process.env.APPSHIP_DEBUG) console.error(err.stack);
  process.exit(err.exitCode ?? 1);
});

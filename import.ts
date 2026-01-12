import { type Subprocess, spawn } from 'bun';

const args = process.argv.slice(2);
if (args.length < 1) {
  console.log('❌ Usage: bun run import <GITHUB_URL> [BRANCH]');
  process.exit(1);
}

const repoUrl = args[0];
const branch = args[1];

console.log(`🚀 Starting Vext Game Import for: ${repoUrl}`);

const cmdArgs = ['apps/backend/src/scripts/import_game.ts', repoUrl];
if (branch) {
  cmdArgs.push('--branch');
  cmdArgs.push(branch);
  cmdArgs.push('--manifest');
  cmdArgs.push('games/aether_strike/vext.json');
}

const proc = spawn({
  cmd: ['bun', 'run', ...cmdArgs],
  cwd: process.cwd(),
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, FORCE_COLOR: '1' },
});

const exitCode = await proc.exited;
if (exitCode === 0) {
  console.log('\n✨ Import Pipeline Completed Successfully!');
} else {
  console.error(`\n💀 Import Failed with code ${exitCode}`);
}
process.exit(exitCode);

#!/usr/bin/env node
import { execSync } from 'node:child_process';

const checks = [];

function run(name, command, help) {
  try {
    const out = execSync(command, { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
    checks.push({ name, ok: true, out });
  } catch (error) {
    const stderr = error.stderr?.toString().trim() || error.message;
    checks.push({ name, ok: false, out: stderr, help });
  }
}

run('Node runtime', 'node --version', 'Install Node.js 20.x and retry.');
run('pnpm runtime', 'pnpm --version', 'Install pnpm (or enable corepack) before running workspace commands.');
run('Docker CLI', 'docker --version', 'Install Docker Desktop / Docker Engine so `docker compose up -d` can run.');
run('Docker Compose', 'docker compose version', 'Install Docker Compose plugin or use a Docker version that bundles compose.');
run('NPM registry reachability', 'npm ping --registry https://registry.npmjs.org', 'Your environment cannot reach npm registry (proxy/policy). Configure an allowed registry or proxy exception.');

let hasFailure = false;
for (const check of checks) {
  if (check.ok) {
    console.log(`✅ ${check.name}: ${check.out}`);
  } else {
    hasFailure = true;
    console.log(`⚠️ ${check.name}: ${check.out}`);
    if (check.help) console.log(`   ↳ ${check.help}`);
  }
}

if (hasFailure) {
  process.exitCode = 1;
  console.log('\nPreflight checks found environment issues. Resolve warnings above, then retry setup commands.');
} else {
  console.log('\nEnvironment looks ready for `pnpm install` + `docker compose up -d` + `pnpm dev`.');
}

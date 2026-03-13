#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const phaseRoot = path.join(repoRoot, 'docs', 'phase0_1');

function printUsage() {
  console.log('Usage:');
  console.log('  node tools/phase0/guard.mjs --id INT-012');
  console.log('  node tools/phase0/guard.mjs --id 012');
  console.log('  node tools/phase0/guard.mjs --id 012A');
  console.log('  node tools/phase0/guard.mjs --id INT-012A');
  console.log('Exit codes:');
  console.log('  0 = all checks passed');
  console.log('  1 = checks failed or invalid usage');
}

function parseId(argv) {
  const idx = argv.indexOf('--id');
  if (idx === -1 || idx + 1 >= argv.length) {
    return null;
  }

  const raw = argv[idx + 1].trim();
  const match = raw.match(/^(?:INT-)?(\d+)([A-Za-z])?$/i);
  if (!match) {
    return null;
  }

  const baseId = match[1].padStart(3, '0');
  const suffix = match[2] ? match[2].toUpperCase() : '';
  const idNorm = `${baseId}${suffix}`;

  return {
    idNorm,
    baseId,
    hasSuffix: suffix.length > 0
  };
}

async function findDoc(dirPath, prefix) {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    const file = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort()
      .find((name) => name.startsWith(`${prefix}-`) && name.endsWith('.md'));

    return file ? path.join(dirPath, file) : null;
  } catch {
    return null;
  }
}

function toRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

async function main() {
  const parsedId = parseId(process.argv.slice(2));
  if (!parsedId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const intakeId = parsedId.hasSuffix ? parsedId.baseId : parsedId.idNorm;
  const intakePrefix = `INT-${intakeId}`;
  const specPrefix = `SPEC-${parsedId.idNorm}`;
  const taskPrefix = `TASK-${parsedId.idNorm}`;
  const proofPrefix = `PROOF-${parsedId.idNorm}`;

  const intake = await findDoc(path.join(phaseRoot, 'intake'), intakePrefix);
  const spec = await findDoc(path.join(phaseRoot, 'specs'), specPrefix);
  const task = await findDoc(path.join(phaseRoot, 'tasks'), taskPrefix);
  const proof = await findDoc(path.join(phaseRoot, 'proof'), proofPrefix);

  let ok = true;

  const checks = [
    ['intake', intake, `docs/phase0_1/intake/${intakePrefix}-*.md`],
    ['spec', spec, `docs/phase0_1/specs/${specPrefix}-*.md`],
    ['task', task, `docs/phase0_1/tasks/${taskPrefix}-*.md`],
    ['proof', proof, `docs/phase0_1/proof/${proofPrefix}-*.md`]
  ];

  for (const [label, filePath, expectedPattern] of checks) {
    if (filePath) {
      console.log(`✅ Found ${label}: ${toRelative(filePath)}`);
    } else {
      console.log(`❌ Missing ${label}: ${expectedPattern}`);
      ok = false;
    }
  }

  if (spec) {
    const specText = await readFile(spec, 'utf8');
    const requiredLinkedIntake = `Linked Intake: INT-${intakeId}`;
    const linked = specText.includes(requiredLinkedIntake);
    if (linked) {
      console.log(`✅ Spec links intake: INT-${intakeId}`);
    } else {
      console.log(`❌ Spec missing link: ${requiredLinkedIntake}`);
      ok = false;
    }
  }

  if (task) {
    const taskText = await readFile(task, 'utf8');
    const requiredLinkedSpec = `Linked Spec: SPEC-${parsedId.idNorm}`;
    const linked = taskText.includes(requiredLinkedSpec);
    if (linked) {
      console.log(`✅ Task links spec: SPEC-${parsedId.idNorm}`);
    } else {
      console.log(`❌ Task missing link: ${requiredLinkedSpec}`);
      ok = false;
    }
  }

  if (proof) {
    const proofText = await readFile(proof, 'utf8');
    const requiredLinkedSpec = `Linked Spec: SPEC-${parsedId.idNorm}`;
    const linked = proofText.includes(requiredLinkedSpec);
    if (linked) {
      console.log(`✅ Proof links spec: SPEC-${parsedId.idNorm}`);
    } else {
      console.log(`❌ Proof missing link: ${requiredLinkedSpec}`);
      ok = false;
    }
  }

  console.log(ok ? '\nPhase0 guard: PASS' : '\nPhase0 guard: FAIL');
  process.exitCode = ok ? 0 : 1;
}

main().catch((error) => {
  console.error('❌ Guard failed with unexpected error.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

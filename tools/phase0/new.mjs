#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function printUsage() {
  console.log('Usage:');
  console.log('  node tools/phase0/new.mjs --id 012 --title "rr-flow-bootstrap"');
  console.log('  node tools/phase0/new.mjs --id INT-012 --title "CTA Routing"');
  console.log('  node tools/phase0/new.mjs --id 012A --title "snapshot-sanitizer"');
  console.log('  node tools/phase0/new.mjs --id INT-012A --title "snapshot-sanitizer"');
  console.log('Exit codes:');
  console.log('  0 = scaffold created (or already exists)');
  console.log('  1 = invalid usage or write/read error');
}

function getArg(name, argv) {
  const idx = argv.indexOf(name);
  if (idx === -1 || idx + 1 >= argv.length) {
    return null;
  }
  return argv[idx + 1];
}

function normalizeId(raw) {
  const match = raw.trim().match(/^(?:INT-)?(\d+)([A-Za-z])?$/i);
  if (!match) {
    return null;
  }

  const digits = match[1].padStart(3, '0');
  const suffix = match[2] ? match[2].toUpperCase() : '';
  return `${digits}${suffix}`;
}

function toSlug(input) {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return slug || 'untitled';
}

function toReadableTitle(input) {
  return input
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

async function ensureDirs(dirs) {
  for (const dir of dirs) {
    await mkdir(dir, { recursive: true });
  }
}

async function createFromTemplate(templatePath, outPath, id, readableTitle) {
  const template = await readFile(templatePath, 'utf8');
  let content = template
    .replaceAll('###', id)
    .replaceAll('<short title>', readableTitle);

  const baseIdMatch = id.match(/^(\d+)/);
  const baseId = baseIdMatch ? baseIdMatch[1] : id;
  const hasSuffix = id !== baseId;

  if (hasSuffix && templatePath.endsWith('spec.template.md')) {
    const normalizedLine = `Linked Intake: INT-${id}`;
    const parentLine = `Linked Intake: INT-${baseId}`;
    if (content.includes(normalizedLine) && !content.includes(parentLine)) {
      content = content.replace(normalizedLine, `${normalizedLine}\n${parentLine}`);
    }
  }

  try {
    await writeFile(outPath, content, { flag: 'wx' });
    return { status: 'created', file: outPath };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
      return { status: 'exists', file: outPath };
    }
    throw error;
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const rawId = getArg('--id', argv);
  const rawTitle = getArg('--title', argv);

  if (!rawId || !rawTitle) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const id = normalizeId(rawId);
  if (!id) {
    console.error('Invalid --id. Use 012, 012A, INT-012, or INT-012A.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const readableTitle = toReadableTitle(rawTitle);
  if (!readableTitle) {
    console.error('Invalid --title. Provide a non-empty value.');
    printUsage();
    process.exitCode = 1;
    return;
  }

  const slug = toSlug(rawTitle);

  const docsRoot = path.join(repoRoot, 'docs', 'phase0_1');
  const templatesRoot = path.join(docsRoot, 'templates');

  const destinations = [
    {
      template: path.join(templatesRoot, 'intake.template.md'),
      out: path.join(docsRoot, 'intake', `INT-${id}-${slug}.md`)
    },
    {
      template: path.join(templatesRoot, 'spec.template.md'),
      out: path.join(docsRoot, 'specs', `SPEC-${id}-${slug}.md`)
    },
    {
      template: path.join(templatesRoot, 'tasks.template.md'),
      out: path.join(docsRoot, 'tasks', `TASK-${id}-${slug}.md`)
    },
    {
      template: path.join(templatesRoot, 'proof.template.md'),
      out: path.join(docsRoot, 'proof', `PROOF-${id}-${slug}.md`)
    }
  ];

  await ensureDirs([
    path.join(docsRoot, 'intake'),
    path.join(docsRoot, 'specs'),
    path.join(docsRoot, 'tasks'),
    path.join(docsRoot, 'proof')
  ]);

  const results = [];
  for (const item of destinations) {
    results.push(await createFromTemplate(item.template, item.out, id, readableTitle));
  }

  for (const result of results) {
    const relative = path.relative(repoRoot, result.file).split(path.sep).join('/');
    if (result.status === 'created') {
      console.log(`[CREATED] ${relative}`);
    } else {
      console.log(`[EXISTS] ${relative}`);
    }
  }

  console.log('\nPhase0 scaffold: complete');
  process.exitCode = 0;
}

main().catch((error) => {
  console.error('[ERROR] Scaffold failed.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

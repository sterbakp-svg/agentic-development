#!/usr/bin/env node
// Regenerates or checks packages/core/test-fixtures/render/*/expected.md.
// The expected output comes only from reference/composer_ref.py (golden rule 3).
//   --write  regenerate every expected.md
//   --check  exit 1 if a stored expected.md differs from the reference output
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fixtures = path.join(root, 'packages/core/test-fixtures/render');
const template = 'templates/email-triage/v1';
const mode = process.argv[2];
if (mode !== '--write' && mode !== '--check') {
  console.error('usage: reference-fixtures.mjs --write | --check');
  process.exit(2);
}

function reference(name) {
  const dir = path.join(fixtures, name);
  const r = spawnSync(
    'python3',
    [
      '-I',
      'reference/composer_ref.py',
      'render',
      template,
      path.join(dir, 'profile.json'),
      path.join(dir, 'slots.json'),
    ],
    { cwd: root, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    console.error(`reference failed: ${name}`);
    process.exit(2);
  }
  return r.stdout;
}

const names = fs
  .readdirSync(fixtures, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();
if (names.length === 0) {
  console.error('no cases found');
  process.exit(2);
}

const differing = [];
for (const name of names) {
  const expectedPath = path.join(fixtures, name, 'expected.md');
  const fresh = reference(name);
  if (mode === '--write') {
    fs.writeFileSync(expectedPath, fresh);
  } else if (!fs.existsSync(expectedPath) || !fs.readFileSync(expectedPath).equals(fresh)) {
    differing.push(name);
  }
}

if (mode === '--write') {
  console.log(`wrote ${names.length} cases`);
} else if (differing.length > 0) {
  console.error('expected.md differs from the reference for:');
  for (const n of differing) console.error(`  ${n}`);
  process.exit(1);
} else {
  console.log(`ok: ${names.length} cases match the reference`);
}

#!/usr/bin/env node
// Regenerates or checks test-fixtures/render/*/expected.md and test-fixtures/validate/*/expected.json.
// The expected output comes only from reference/composer_ref.py (golden rule 3).
//   --write  regenerate every expected file
//   --check  exit 1 if a stored expected file differs from the reference output
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const fixtureRoot = path.join(root, 'packages/core/test-fixtures');
const template = 'templates/email-triage/v1';
const mode = process.argv[2];
if (mode !== '--write' && mode !== '--check') {
  console.error('usage: reference-fixtures.mjs --write | --check');
  process.exit(2);
}

// Each suite: folder, reference command, input file names, stored output file.
const suites = [
  {
    folder: 'render',
    command: 'render',
    inputs: ['profile.json', 'slots.json'],
    output: 'expected.md',
  },
  {
    folder: 'validate',
    command: 'validate',
    inputs: ['profile.json', 'generator-output.json'],
    output: 'expected.json',
  },
];

function reference(suite, name) {
  const dir = path.join(fixtureRoot, suite.folder, name);
  const r = spawnSync(
    'python3',
    [
      '-I',
      'reference/composer_ref.py',
      suite.command,
      template,
      ...suite.inputs.map((f) => path.join(dir, f)),
    ],
    { cwd: root, encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    console.error(`reference failed: ${suite.folder}/${name}`);
    process.exit(2);
  }
  return r.stdout;
}

const differing = [];
let total = 0;
for (const suite of suites) {
  const dir = path.join(fixtureRoot, suite.folder);
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  if (names.length === 0) {
    console.error(`no cases found in ${suite.folder}`);
    process.exit(2);
  }
  for (const name of names) {
    const expectedPath = path.join(dir, name, suite.output);
    const fresh = reference(suite, name);
    if (mode === '--write') {
      fs.writeFileSync(expectedPath, fresh);
    } else if (!fs.existsSync(expectedPath) || !fs.readFileSync(expectedPath).equals(fresh)) {
      differing.push(`${suite.folder}/${name}`);
    }
  }
  total += names.length;
}

if (mode === '--write') {
  console.log(`wrote ${total} cases`);
} else if (differing.length > 0) {
  console.error('stored expected output differs from the reference for:');
  for (const n of differing) console.error(`  ${n}`);
  process.exit(1);
} else {
  console.log(`ok: ${total} cases match the reference`);
}

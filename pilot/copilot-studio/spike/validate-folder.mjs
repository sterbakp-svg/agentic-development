// T-020 spike, point 2: runs the reference validator on every saved model output in a folder.
// Usage: node pilot/copilot-studio/spike/validate-folder.mjs <profile.json> <folder>
// Prints only: file name, parses (yes/no), ok (yes/no), error count. No slot content.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const [profileArg, folderArg] = process.argv.slice(2);
if (!profileArg || !folderArg) {
  console.error('Usage: node validate-folder.mjs <profile.json> <folder>');
  process.exit(2);
}
const profile = resolve(profileArg);
const folder = resolve(folderArg);
const files = readdirSync(folder)
  .filter((f) => f.endsWith('.json') || f.endsWith('.txt'))
  .sort();
if (files.length === 0) {
  console.error('No .json or .txt files in the folder.');
  process.exit(2);
}

const work = mkdtempSync(join(tmpdir(), 'spike-validate-'));
let parsed = 0;
let passed = 0;
console.log('file\tparses\tok\terrors');
try {
  for (const file of files) {
    let data;
    try {
      data = JSON.parse(readFileSync(join(folder, file), 'utf8'));
    } catch {
      console.log(`${file}\tno\tno\t-`);
      continue;
    }
    parsed += 1;
    const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
    if (!isObject(data) || !isObject(data.slots)) {
      console.log(`${file}\tyes\tno\tshape: no slots object`);
      continue;
    }
    // Write a copy, so the validator reads exactly the saved JSON.
    const copy = join(work, 'candidate.json');
    writeFileSync(copy, JSON.stringify(data), 'utf8');
    try {
      const out = execFileSync(
        'python3',
        [
          '-I',
          join(root, 'reference', 'composer_ref.py'),
          'validate',
          join(root, 'templates', 'email-triage', 'v1'),
          profile,
          copy,
        ],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
      );
      const result = JSON.parse(out);
      if (result.ok) passed += 1;
      console.log(`${file}\tyes\t${result.ok ? 'yes' : 'no'}\t${result.errors.length}`);
    } catch {
      // The reference crashes on wrong types (for example a slot that is not a string).
      console.log(`${file}\tyes\tno\tvalidator crashed (wrong types)`);
    }
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`parsed ${parsed}/${files.length}, validator ok ${passed}/${files.length}`);

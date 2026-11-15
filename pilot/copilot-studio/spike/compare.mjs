// T-020 spike, point 3: compares the flow output with a golden expected-instructions.md.
// Usage: node pilot/copilot-studio/spike/compare.mjs <cio-insurance|tprm-analyst> <flow-output-file>
// The flow output file may be the raw text, a JSON string, or a JSON object with an
// "instructions" field (as copied from the flow run history). Prints numbers only.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const [name, file] = process.argv.slice(2);
if (!name || !file) {
  console.error('Usage: node compare.mjs <cio-insurance|tprm-analyst> <flow-output-file>');
  process.exit(2);
}
const expected = readFileSync(join(root, 'examples', name, 'expected-instructions.md'), 'utf8');
let actual = readFileSync(file, 'utf8');
let unwrapped = 'no';
try {
  const data = JSON.parse(actual);
  if (typeof data === 'string') {
    actual = data;
    unwrapped = 'JSON string';
  } else if (data && typeof data.instructions === 'string') {
    actual = data.instructions;
    unwrapped = 'JSON object, field instructions';
  }
} catch {
  // Not JSON: compare the file as it is.
}

const exact = actual === expected;
const sameWithoutFinalNewline = actual.replace(/\n+$/, '') === expected.replace(/\n+$/, '');
const hasCr = actual.includes('\r');
console.log(`unwrapped: ${unwrapped}`);
console.log(`expected chars: ${expected.length}, actual chars: ${actual.length}`);
console.log(`carriage returns in actual: ${hasCr ? 'yes' : 'no'}`);
console.log(`byte-identical: ${exact ? 'yes' : 'no'}`);
if (!exact) {
  console.log(`identical except final newline: ${sameWithoutFinalNewline ? 'yes' : 'no'}`);
  const a = actual.split('\n');
  const e = expected.split('\n');
  const n = Math.min(a.length, e.length);
  let line = 0;
  while (line < n && a[line] === e[line]) line += 1;
  if (line < n || a.length !== e.length) console.log(`first differing line: ${line + 1}`);
}
process.exit(exact ? 0 : 1);

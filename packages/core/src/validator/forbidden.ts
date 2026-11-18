import { PY_WS } from '../renderer/py-strip';

// Hand-written Python `re` semantics. JS flags alone do not give the same result.
// Python \w and \b are Unicode aware; JS \w and \b are ASCII only even with the u flag.
const W = String.raw`\p{L}\p{N}_`;
const BOUND_BEFORE = `(?<![${W}])`; // Python \b in front of a word character
const BOUND_AFTER = `(?![${W}])`; // Python \b after a word character

export interface ForbiddenRule {
  /** Pattern text exactly as the Python reference prints it in the message. */
  readonly source: string;
  /** Tests a slot value. Case-insensitive rules fold the text the way Python re.I does. */
  readonly test: (value: string) => boolean;
}

// Python re.I folds with simple lowercase plus the sre equivalence table. For the letters used by
// the patterns, that adds: dotless i (U+0131), dotted I (U+0130), long s (U+017F), Kelvin sign (U+212A).
const FOLD_EXTRA = new Map<string, string>([
  ['ı', 'i'],
  ['İ', 'i'],
  ['ſ', 's'],
  ['K', 'k'],
]);

function pyFold(s: string): string {
  let out = '';
  for (const ch of s) {
    const extra = FOLD_EXTRA.get(ch);
    if (extra !== undefined) {
      out += extra;
      continue;
    }
    const lower = ch.toLowerCase();
    // Python uses the simple (one code point) mapping; keep the char if the full mapping is longer.
    out += [...lower].length === 1 ? lower : ch;
  }
  return out;
}

const rx = (src: string): RegExp => new RegExp(src, 'u');
const folded = (re: RegExp) => (v: string) => re.test(pyFold(v));
const plain = (re: RegExp) => (v: string) => re.test(v);

const BRACES = rx(String.raw`\{\{|\}\}`);
const NEWLINE = rx(String.raw`[\r\n]`);
const BACKTICK = rx('`');
// re.M: ^ matches only at the start or after \n (not after \r or U+2028). \s is Python str.isspace.
const HEADING = rx(`(?:^|\\n)[${PY_WS}]*#`);
const IGNORE = rx('ignore (all|any|the|previous|above)');
const DISREGARD = rx('disregard');
const AUTO = rx(
  `${BOUND_BEFORE}(send|forward|delete|move)${BOUND_AFTER}[^.;]*` +
    `${BOUND_BEFORE}(automatically|without (asking|review))`,
);

/** Port of FORBIDDEN_IN_SLOTS in reference/composer_ref.py, same order. */
export const FORBIDDEN_IN_SLOTS: readonly ForbiddenRule[] = [
  { source: String.raw`\{\{|\}\}`, test: plain(BRACES) },
  { source: String.raw`[\r\n]`, test: plain(NEWLINE) },
  { source: '`', test: plain(BACKTICK) },
  { source: String.raw`^\s*#`, test: plain(HEADING) },
  { source: 'ignore (all|any|the|previous|above)', test: folded(IGNORE) },
  { source: 'disregard', test: folded(DISREGARD) },
  {
    source: String.raw`\b(send|forward|delete|move)\b[^.;]*\b(automatically|without (asking|review))`,
    test: folded(AUTO),
  },
];

/**
 * Port of EMAIL_RE `[\w.+-]+@[\w-]+\.[\w.-]+` (Unicode \w). Only used with test(), so the
 * leading and trailing `+` are dropped: a match exists exactly when the reduced pattern matches,
 * and the reduced pattern does not slow down on long runs of word characters.
 */
export const EMAIL_RE = new RegExp(`[${W}.+-]@[${W}-]+\\.[${W}.-]`, 'u');

/** Port of `re.findall(r"\[[^\]\n]+\]", text)`. */
export const PLACEHOLDER_RE = /\[[^\]\n]+\]/g;

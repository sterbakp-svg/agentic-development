// Characters for which Python's str.isspace() is true. JS trim() differs
// (U+001C..U+001F and U+0085 are not trimmed by JS; U+FEFF is trimmed by JS, not by Python).
export const PY_WS =
  '\\t\\n\\v\\f\\r\\u001c-\\u001f \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000';
const LEFT = new RegExp(`^[${PY_WS}]+`);
const RIGHT = new RegExp(`[${PY_WS}]+$`);

/** Same as Python `str.strip()` with no argument. */
export function pyStrip(s: string): string {
  return s.replace(LEFT, '').replace(RIGHT, '');
}

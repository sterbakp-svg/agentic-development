// The one place that reads files for the kit: size is checked with stat before anything is read.
import { readFileSync, statSync } from 'node:fs';

/** Largest file the kit reads. A prompt tool output or a profile is a few KB. */
export const MAX_FILE_BYTES = 1_000_000;

export class FileTooLargeError extends Error {
  constructor() {
    super('file is too large');
  }
}

/** Reads a regular file as UTF-8 text. Throws FileTooLargeError before reading a file over the limit. */
export function readSmallFile(file: string): string {
  const st = statSync(file);
  if (!st.isFile()) throw new Error('not a regular file');
  if (st.size > MAX_FILE_BYTES) throw new FileTooLargeError();
  return readFileSync(file, 'utf8');
}

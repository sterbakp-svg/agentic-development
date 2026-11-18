import type { Parity } from './schema';

export interface Outcome {
  valid: boolean;
  errorCodes: readonly string[];
}

const count = (codes: readonly string[]): Map<string, number> => {
  const m = new Map<string, number>();
  for (const c of codes) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
};

/**
 * Compares the flow result with the repository result for the same output (Q-13, T-020 section 4).
 * The flow may be stricter than the reference, never weaker: every repository error must have a
 * flow check that rejects at least the same input. Codes carry IDs (`forbidden_content.<slot>.<kind>`,
 * see codes.ts), so the comparison is per code, and a code that the repository reports n times must
 * be reported at least n times by the flow.
 * - same: both accept, or both reject with the same codes.
 * - flow-stricter: the flow reports everything the repository does, and more (or rejects what the
 *   repository accepts).
 * - flow-weaker: the flow misses a repository error or accepts what the repository rejects.
 *   Blocks the release.
 */
export function computeParity(repo: Outcome, flow: Outcome): Parity {
  const flowCounts = count(flow.errorCodes);
  const repoCounts = count(repo.errorCodes);
  const missed = [...repoCounts].some(([code, n]) => (flowCounts.get(code) ?? 0) < n);
  if (!repo.valid && (flow.valid || missed)) return 'flow-weaker';
  if (repo.valid && flow.valid) return 'same';
  if (repo.valid) return 'flow-stricter';
  const extra = [...flowCounts].some(([code, n]) => n > (repoCounts.get(code) ?? 0));
  return extra ? 'flow-stricter' : 'same';
}

import type { Parity } from './schema';

export interface Outcome {
  valid: boolean;
  errorCodes: readonly string[];
}

/**
 * Compares the flow result with the repository result for the same output (Q-13).
 * The flow may be stricter than the reference, never weaker: every repository error code must also
 * be reported by the flow, and a repository rejection must be a flow rejection.
 * - same: both accept, or both reject with the same set of codes.
 * - flow-stricter: the flow reports everything the repository does, and more (or rejects what the
 *   repository accepts).
 * - flow-weaker: the flow misses a repository error. Blocks the release.
 */
export function computeParity(repo: Outcome, flow: Outcome): Parity {
  const flowCodes = new Set(flow.errorCodes);
  const repoCodes = new Set(repo.errorCodes);
  if (!repo.valid && (flow.valid || [...repoCodes].some((c) => !flowCodes.has(c)))) {
    return 'flow-weaker';
  }
  if (repo.valid && flow.valid) return 'same';
  if (repo.valid) return 'flow-stricter';
  return flowCodes.size > repoCodes.size ? 'flow-stricter' : 'same';
}

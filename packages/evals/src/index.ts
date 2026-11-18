// Public API of @agent-composer/evals: model-free tools for the manual evals (ADR-001, T-013).
export * from './schema';
export { applyPreset, buildProfileJson, loadPreset, loadPresetFile, type Preset } from './input';
export { errorCode, warningCode } from './codes';
export { computeParity } from './parity';
export { evaluateCase, thresholdFor, minScorersFor } from './scoring';
export {
  checkRun,
  loadRunFile,
  RunFileError,
  type CheckEntry,
  type CheckOptions,
  type RunCheck,
} from './check';
export { summarizeRun, renderMarkdown, type ReportEntry, type RunReport } from './summary';

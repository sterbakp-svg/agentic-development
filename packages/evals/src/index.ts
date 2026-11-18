// Public API of @agent-composer/evals: model-free tools for the manual evals (ADR-001, T-013).
export * from './schema';
export { buildProfileJson, loadPreset, loadPresetFile, type Preset } from './input';
export { errorCode, warningCode, FORBIDDEN_KINDS } from './codes';
export { computeParity } from './parity';
export { evaluateCase, evaluateCaseGroup, thresholdFor, minScorersFor } from './scoring';
export { MAX_FILE_BYTES } from './files';
export {
  checkRun,
  loadRunFile,
  RunFileError,
  type CheckEntry,
  type CheckOptions,
  type RunCheck,
} from './check';
export { summarizeRun, renderMarkdown, type CaseReport,
  type ReportEntry, type RunReport } from './summary';

/** Default client settings. Every value can be overridden through `ModelConfig` or the request. */
export const DEFAULT_TIMEOUT_MS = 45_000;
export const DEFAULT_MAX_ATTEMPTS = 3;
export const DEFAULT_BASE_DELAY_MS = 1_000;
/** Longest delay before a retry. A server that asks for more gets no retry. */
export const DEFAULT_MAX_RETRY_DELAY_MS = 30_000;
export const DEFAULT_TEMPERATURE = 0.2;
export const DEFAULT_MAX_OUTPUT_TOKENS = 3_000;

export type ModelErrorCode =
  'config' | 'auth' | 'http' | 'timeout' | 'network' | 'refusal' | 'truncated' | 'invalid_json';

/**
 * Error of the model client. The message is fixed text built by this package;
 * it never contains prompt text, response text or credential messages.
 */
export class ModelError extends Error {
  readonly code: ModelErrorCode;
  /** HTTP status, only for errors that came from an HTTP response. */
  readonly status: number | undefined;
  /** Number of attempts made when the call failed. Set by the client. */
  attempts: number | undefined;

  constructor(
    code: ModelErrorCode,
    message: string,
    options: { status?: number; attempts?: number } = {},
  ) {
    super(message);
    this.name = 'ModelError';
    this.code = code;
    this.status = options.status;
    this.attempts = options.attempts;
  }
}

import { DEFAULT_BASE_DELAY_MS, DEFAULT_MAX_ATTEMPTS, DEFAULT_TIMEOUT_MS } from './defaults';
import { ModelError } from './errors';

export interface ModelConfig {
  /** Azure OpenAI endpoint, https, without trailing slash. */
  endpoint: string;
  deployment: string;
  apiVersion: string;
  /** Timeout per attempt in milliseconds. */
  timeoutMs: number;
  /** Total number of attempts, including the first. */
  maxAttempts: number;
  /** Base of the exponential backoff in milliseconds. */
  baseDelayMs: number;
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
  const value = env[name];
  if (value === undefined || value === '') {
    throw new ModelError('config', `Missing environment variable ${name}.`);
  }
  return value;
}

function parseEndpoint(raw: string): string {
  const message = 'AOAI_ENDPOINT must be a valid https URL.';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ModelError('config', message);
  }
  if (url.protocol !== 'https:') throw new ModelError('config', message);
  return raw.replace(/\/+$/, '');
}

function parseTimeout(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_TIMEOUT_MS;
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new ModelError('config', 'AOAI_TIMEOUT_MS must be a positive whole number.');
  }
  return Number(raw);
}

/**
 * Reads the model configuration from environment variables.
 * AOAI_API_KEY is ignored on purpose: the client only uses Entra ID tokens.
 */
export function loadModelConfig(env: Env = process.env): ModelConfig {
  return {
    endpoint: parseEndpoint(required(env, 'AOAI_ENDPOINT')),
    deployment: required(env, 'AOAI_DEPLOYMENT'),
    apiVersion: required(env, 'AOAI_API_VERSION'),
    timeoutMs: parseTimeout(env.AOAI_TIMEOUT_MS),
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    baseDelayMs: DEFAULT_BASE_DELAY_MS,
  };
}

import {
  DEFAULT_BASE_DELAY_MS,
  DEFAULT_MAX_ATTEMPTS,
  DEFAULT_MAX_RETRY_DELAY_MS,
  DEFAULT_TIMEOUT_MS,
} from './defaults';
import { ModelError } from './errors';

export type AuthMode = 'managed_identity' | 'developer';

export interface ModelConfig {
  /** Azure OpenAI endpoint origin: https, no path, no trailing slash. */
  endpoint: string;
  deployment: string;
  apiVersion: string;
  /** Timeout per attempt in milliseconds. */
  timeoutMs: number;
  /** Total number of attempts, including the first. */
  maxAttempts: number;
  /** Base of the exponential backoff in milliseconds. */
  baseDelayMs: number;
  /** Longest accepted retry delay in milliseconds; a longer server request ends the call. */
  maxRetryDelayMs: number;
  /** `managed_identity` in Azure (default), `developer` for local sign-in. */
  authMode: AuthMode;
  /** Client ID of a user-assigned managed identity. Optional. */
  managedIdentityClientId?: string | undefined;
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
  const message =
    'AOAI_ENDPOINT must be an https URL with no path, query, fragment or credentials.';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ModelError('config', message);
  }
  if (
    url.protocol !== 'https:' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== '' ||
    url.username !== '' ||
    url.password !== ''
  ) {
    throw new ModelError('config', message);
  }
  return url.origin;
}

function parseTimeout(raw: string | undefined): number {
  if (raw === undefined) return DEFAULT_TIMEOUT_MS;
  if (!/^[1-9][0-9]*$/.test(raw)) {
    throw new ModelError('config', 'AOAI_TIMEOUT_MS must be a positive whole number.');
  }
  return Number(raw);
}

function parseAuthMode(raw: string | undefined): AuthMode {
  if (raw === undefined) return 'managed_identity';
  if (raw === 'managed_identity' || raw === 'developer') return raw;
  throw new ModelError('config', 'AOAI_AUTH_MODE must be managed_identity or developer.');
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
    maxRetryDelayMs: DEFAULT_MAX_RETRY_DELAY_MS,
    authMode: parseAuthMode(env.AOAI_AUTH_MODE),
    managedIdentityClientId: env.AZURE_CLIENT_ID || undefined,
  };
}

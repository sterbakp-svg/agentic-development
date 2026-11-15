import type { ModelConfig } from './config';
import { DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_TEMPERATURE } from './defaults';
import { ModelError } from './errors';
import type { ModelErrorCode } from './errors';
import { toStrictJsonSchema } from './strict-schema';
import type { TokenProvider } from './token';

export interface ModelCallMetrics {
  requestId: string;
  deployment: string;
  outcome: 'ok' | ModelErrorCode;
  attempts: number;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface StructuredRequest {
  requestId: string;
  system: string;
  user: string;
  schemaName: string;
  schema: unknown;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StructuredResult {
  output: unknown;
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
  attempts: number;
  latencyMs: number;
}

export interface ModelClient {
  generateStructured(request: StructuredRequest): Promise<StructuredResult>;
}

interface ClientDeps {
  getToken: TokenProvider;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  onMetrics?: (metrics: ModelCallMetrics) => void;
}

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

type Usage = StructuredResult['usage'];
type Attempt =
  | { ok: true; output: unknown; usage: Usage }
  | { ok: false; error: ModelError; transient: boolean; retryAfterMs?: number };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function retryAfterMs(res: Response): number | undefined {
  const raw = res.headers.get('retry-after')?.trim();
  if (raw === undefined || !/^[0-9]+$/.test(raw)) return undefined;
  return Number(raw) * 1000;
}

function fail(error: ModelError, transient = false, retryAfter?: number): Attempt {
  return { ok: false, error, transient, retryAfterMs: retryAfter };
}

/** Reads a chat completion by hand. Never puts response text into an error. */
function readCompletion(body: unknown): Attempt {
  const shapeError = () => fail(new ModelError('invalid_json', 'Unexpected response shape.'));
  if (!isRecord(body) || !Array.isArray(body.choices) || !isRecord(body.choices[0])) {
    return shapeError();
  }
  const choice: Record<string, unknown> = body.choices[0];
  const message = choice.message;
  if (!isRecord(message)) return shapeError();

  if (typeof message.refusal === 'string' && message.refusal !== '') {
    return fail(new ModelError('refusal', 'The model refused the request.'));
  }
  if (choice.finish_reason === 'content_filter') {
    return fail(new ModelError('refusal', 'The response was blocked by the content filter.'));
  }
  if (choice.finish_reason === 'length') {
    return fail(new ModelError('truncated', 'The response was cut off at the token limit.'));
  }
  if (typeof message.content !== 'string') return shapeError();

  let output: unknown;
  try {
    output = JSON.parse(message.content);
  } catch {
    return fail(new ModelError('invalid_json', 'The response is not valid JSON.'));
  }
  const u = isRecord(body.usage) ? body.usage : {};
  return {
    ok: true,
    output,
    usage: {
      promptTokens: num(u.prompt_tokens),
      completionTokens: num(u.completion_tokens),
      totalTokens: num(u.total_tokens),
    },
  };
}

/**
 * Creates the Azure OpenAI client (structured output, Entra ID bearer token only).
 *
 * Retry policy: network errors, timeouts and HTTP 408, 429, 500, 502, 503, 504 are
 * retried up to `config.maxAttempts` attempts in total. The delay is the `Retry-After`
 * header in seconds, or `baseDelayMs * 2^(n-1)`. Each attempt has its own timeout and
 * gets a fresh token. Refusals, truncation, invalid JSON and other HTTP errors are not retried.
 *
 * Nothing is logged. `onMetrics` is called once per call with IDs, counts and
 * latency only; no prompt, response or credential text reaches errors or metrics.
 */
export function createModelClient(config: ModelConfig, deps: ClientDeps): ModelClient {
  const doFetch = deps.fetch ?? globalThis.fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const now = deps.now ?? Date.now;
  const url =
    `${config.endpoint}/openai/deployments/${encodeURIComponent(config.deployment)}` +
    `/chat/completions?api-version=${encodeURIComponent(config.apiVersion)}`;

  async function attemptOnce(req: StructuredRequest): Promise<Attempt> {
    let token: string;
    try {
      token = await deps.getToken();
    } catch (e) {
      return fail(
        e instanceof ModelError ? e : new ModelError('auth', 'Could not get an Entra ID token.'),
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          temperature: req.temperature ?? DEFAULT_TEMPERATURE,
          max_completion_tokens: req.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: req.schemaName,
              strict: true,
              schema: toStrictJsonSchema(req.schema),
            },
          },
        }),
      });

      if (!res.ok) {
        const status = res.status;
        if (status === 401 || status === 403) {
          return fail(
            new ModelError('auth', `Model request rejected with HTTP ${status}.`, { status }),
          );
        }
        return fail(
          new ModelError('http', `Model request failed with HTTP ${status}.`, { status }),
          RETRYABLE_STATUS.has(status),
          retryAfterMs(res),
        );
      }

      let body: unknown;
      try {
        body = await res.json();
      } catch (e) {
        if (controller.signal.aborted) throw e;
        return fail(new ModelError('invalid_json', 'The response body is not valid JSON.'));
      }
      return readCompletion(body);
    } catch {
      return controller.signal.aborted
        ? fail(new ModelError('timeout', 'The model request timed out.'), true)
        : fail(new ModelError('network', 'The model request failed on the network.'), true);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async generateStructured(req) {
      const start = now();
      let attempts = 0;
      let last: Attempt;
      for (;;) {
        attempts++;
        last = await attemptOnce(req);
        if (last.ok || !last.transient || attempts >= config.maxAttempts) break;
        await sleep(last.retryAfterMs ?? config.baseDelayMs * 2 ** (attempts - 1));
      }
      const latencyMs = now() - start;

      const metrics: ModelCallMetrics = {
        requestId: req.requestId,
        deployment: config.deployment,
        outcome: last.ok ? 'ok' : last.error.code,
        attempts,
        latencyMs,
      };
      if (last.ok) {
        metrics.promptTokens = last.usage.promptTokens;
        metrics.completionTokens = last.usage.completionTokens;
        metrics.totalTokens = last.usage.totalTokens;
      }
      try {
        deps.onMetrics?.(metrics);
      } catch {
        // A broken metrics sink must not change the result.
      }

      if (!last.ok) {
        last.error.attempts = attempts;
        throw last.error;
      }
      return { output: last.output, usage: last.usage, attempts, latencyMs };
    },
  };
}

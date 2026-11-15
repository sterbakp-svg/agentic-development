import { vi } from 'vitest';
import type { ModelConfig } from '../index';

export const baseConfig: ModelConfig = {
  endpoint: 'https://aoai.example.test',
  deployment: 'dep-test',
  apiVersion: '2099-01-01',
  timeoutMs: 45000,
  maxAttempts: 3,
  baseDelayMs: 1000,
};

export const schema = {
  type: 'object',
  required: ['answer'],
  additionalProperties: false,
  properties: { answer: { type: 'string' } },
};

export function completion(
  content: string,
  extra: { refusal?: string | null; finish_reason?: string; usage?: object } = {},
): Response {
  const body = {
    choices: [
      {
        finish_reason: extra.finish_reason ?? 'stop',
        message: { role: 'assistant', content, refusal: extra.refusal ?? null },
      },
    ],
    usage: extra.usage ?? { prompt_tokens: 11, completion_tokens: 7, total_tokens: 18 },
  };
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

export function okResponse(): Response {
  return completion('{"answer":"hi"}');
}

export function httpResponse(
  status: number,
  headers: Record<string, string> = {},
  body = '{}',
): Response {
  return new Response(body, { status, headers });
}

export function request(over: Record<string, unknown> = {}) {
  return {
    requestId: 'req-1',
    system: 'You are a test.',
    user: 'Say hi.',
    schemaName: 'test_schema',
    schema,
    ...over,
  };
}

/** A fake clock: every call advances by `step` ms. */
export function fakeNow(step = 50) {
  let t = 1000;
  return () => {
    const v = t;
    t += step;
    return v;
  };
}

/** Parses the JSON body of a recorded fetch call. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper reads untyped request JSON
export function parseBody(call: unknown[]): any {
  return JSON.parse((call[1] as RequestInit).body as string);
}

export function newFetch(...responses: Array<Response | Error | (() => Promise<Response>)>) {
  const queue = [...responses];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- typed params give mock.calls its tuple type
  return vi.fn(async (_url: unknown, _init?: RequestInit) => {
    const next = queue.shift();
    if (next === undefined) throw new Error('test: fetch called more often than expected');
    if (next instanceof Error) throw next;
    if (typeof next === 'function') return next();
    return next;
  });
}

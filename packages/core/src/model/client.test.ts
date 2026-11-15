import { afterEach, describe, expect, it, vi } from 'vitest';
import { createModelClient, ModelError, toStrictJsonSchema } from '../index';
import type { ModelCallMetrics, ModelErrorCode } from '../index';
import {
  baseConfig,
  completion,
  fakeNow,
  httpResponse,
  newFetch,
  okResponse,
  parseBody,
  request,
} from './test-helpers';

function setup(
  fetchImpl: ReturnType<typeof newFetch>,
  config: Partial<typeof baseConfig> = {},
  getToken: () => Promise<string> = async () => 'token-abc',
) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- typed params give mock.calls its tuple type
  const sleep = vi.fn(async (_ms: number) => {});
  const metrics: ModelCallMetrics[] = [];
  const client = createModelClient(
    { ...baseConfig, ...config },
    {
      getToken,
      fetch: fetchImpl as unknown as typeof fetch,
      sleep,
      now: fakeNow(50),
      onMetrics: (m) => metrics.push(m),
    },
  );
  return { client, sleep, metrics };
}

async function failure(p: Promise<unknown>): Promise<ModelError> {
  try {
    await p;
  } catch (e) {
    return e as ModelError;
  }
  throw new Error('expected the call to fail');
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('request shape', () => {
  it('POSTs to the deployment URL with api-version', async () => {
    const f = newFetch(okResponse());
    const { client } = setup(f);
    await client.generateStructured(request());
    expect(f).toHaveBeenCalledTimes(1);
    expect(String(f.mock.calls[0]![0])).toBe(
      'https://aoai.example.test/openai/deployments/dep-test/chat/completions?api-version=2099-01-01',
    );
    expect(f.mock.calls[0]![1]!.method).toBe('POST');
  });

  it('sends Authorization Bearer and never an api-key header', async () => {
    const f = newFetch(okResponse());
    const { client } = setup(f);
    await client.generateStructured(request());
    const headers = new Headers(f.mock.calls[0]![1]!.headers);
    expect(headers.get('authorization')).toBe('Bearer token-abc');
    expect(headers.has('api-key')).toBe(false);
    expect(headers.get('content-type')).toContain('application/json');
  });

  it('sends system then user message', async () => {
    const f = newFetch(okResponse());
    const { client } = setup(f);
    await client.generateStructured(request({ system: 'SYS', user: 'USR' }));
    expect(parseBody(f.mock.calls[0]!).messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USR' },
    ]);
  });

  it('uses temperature 0.2 and max_completion_tokens 3000 by default', async () => {
    const f = newFetch(okResponse());
    const { client } = setup(f);
    await client.generateStructured(request());
    const body = parseBody(f.mock.calls[0]!);
    expect(body.temperature).toBe(0.2);
    expect(body.max_completion_tokens).toBe(3000);
    expect(body).not.toHaveProperty('max_tokens');
  });

  it('lets the request override temperature and max output tokens', async () => {
    const f = newFetch(okResponse());
    const { client } = setup(f);
    await client.generateStructured(request({ temperature: 0, maxOutputTokens: 500 }));
    const body = parseBody(f.mock.calls[0]!);
    expect(body.temperature).toBe(0);
    expect(body.max_completion_tokens).toBe(500);
  });

  it('sends a strict json_schema response_format built with toStrictJsonSchema', async () => {
    const f = newFetch(okResponse());
    const { client } = setup(f);
    const input = {
      type: 'object',
      required: ['answer'],
      properties: { answer: { type: 'string', maxLength: 5 }, extra: { type: 'string' } },
    };
    await client.generateStructured(request({ schemaName: 'my_schema', schema: input }));
    expect(parseBody(f.mock.calls[0]!).response_format).toEqual({
      type: 'json_schema',
      json_schema: { name: 'my_schema', strict: true, schema: toStrictJsonSchema(input) },
    });
  });
});

describe('success', () => {
  it('parses message content as JSON and maps usage', async () => {
    const f = newFetch(
      completion('{"answer":"yes","n":2}', {
        usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
      }),
    );
    const { client } = setup(f);
    const res = await client.generateStructured(request());
    expect(res.output).toEqual({ answer: 'yes', n: 2 });
    expect(res.usage).toEqual({ promptTokens: 100, completionTokens: 40, totalTokens: 140 });
    expect(res.attempts).toBe(1);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('requests a fresh token for every attempt', async () => {
    let n = 0;
    const getToken = vi.fn(async () => `tok-${++n}`);
    const f = newFetch(httpResponse(503), httpResponse(503), okResponse());
    const { client } = setup(f, {}, getToken);
    await client.generateStructured(request());
    expect(getToken).toHaveBeenCalledTimes(3);
    const auth = f.mock.calls.map((c) => new Headers(c[1]!.headers).get('authorization'));
    expect(auth).toEqual(['Bearer tok-1', 'Bearer tok-2', 'Bearer tok-3']);
  });
});

describe('non-transient errors are not retried', () => {
  it.each<[string, () => Response, ModelErrorCode, number | undefined]>([
    [
      'refusal',
      () => completion('', { refusal: 'I cannot help with that.' }),
      'refusal',
      undefined,
    ],
    [
      'finish_reason length',
      () => completion('{"answer":"cut', { finish_reason: 'length' }),
      'truncated',
      undefined,
    ],
    ['content is not JSON', () => completion('this is not json'), 'invalid_json', undefined],
    ['401', () => httpResponse(401), 'auth', 401],
    ['403', () => httpResponse(403), 'auth', 403],
    ['400', () => httpResponse(400), 'http', 400],
    ['404', () => httpResponse(404), 'http', 404],
    ['409', () => httpResponse(409), 'http', 409],
    ['422', () => httpResponse(422), 'http', 422],
  ])('%s -> one attempt, no sleep', async (_label, make, code, status) => {
    const f = newFetch(make(), make(), make());
    const { client, sleep, metrics } = setup(f);
    const err = await failure(client.generateStructured(request()));
    expect(err).toBeInstanceOf(ModelError);
    expect(err.code).toBe(code);
    expect(err.status).toBe(status);
    expect(err.attempts).toBe(1);
    expect(f).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(metrics).toHaveLength(1);
    expect(metrics[0]!.outcome).toBe(code);
    expect(metrics[0]!.attempts).toBe(1);
  });

  it('refusal wins over empty content even with finish_reason stop', async () => {
    const f = newFetch(completion('', { refusal: 'no', finish_reason: 'stop' }));
    const { client } = setup(f);
    expect((await failure(client.generateStructured(request()))).code).toBe('refusal');
  });

  it('a failing token provider is an auth error and is not retried', async () => {
    const f = newFetch(okResponse());
    const getToken = async (): Promise<string> => {
      throw new ModelError('auth', 'no token');
    };
    const { client, sleep } = setup(f, {}, getToken);
    const err = await failure(client.generateStructured(request()));
    expect(err.code).toBe('auth');
    expect(f).not.toHaveBeenCalled();
    expect(sleep).not.toHaveBeenCalled();
  });
});

describe('retry on transient errors', () => {
  it.each([408, 429, 500, 502, 503, 504])('HTTP %i is retried and can recover', async (status) => {
    const f = newFetch(httpResponse(status), okResponse());
    const { client, sleep, metrics } = setup(f);
    const res = await client.generateStructured(request());
    expect(res.attempts).toBe(2);
    expect(f).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ outcome: 'ok', attempts: 2 });
  });

  it('a network error (fetch rejects) is retried and can recover', async () => {
    const f = newFetch(new TypeError('fetch failed'), okResponse());
    const { client } = setup(f);
    expect((await client.generateStructured(request())).attempts).toBe(2);
  });

  it('exhausting attempts on HTTP 503 gives http error with status and attempts', async () => {
    const f = newFetch(httpResponse(503), httpResponse(503), httpResponse(503), httpResponse(503));
    const { client, metrics } = setup(f);
    const err = await failure(client.generateStructured(request()));
    expect(err.code).toBe('http');
    expect(err.status).toBe(503);
    expect(err.attempts).toBe(3);
    expect(f).toHaveBeenCalledTimes(3);
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({ outcome: 'http', attempts: 3 });
  });

  it('exhausting attempts on network errors gives network error', async () => {
    const f = newFetch(new TypeError('x'), new TypeError('x'), new TypeError('x'));
    const { client } = setup(f);
    const err = await failure(client.generateStructured(request()));
    expect(err.code).toBe('network');
    expect(err.attempts).toBe(3);
  });

  it('respects maxAttempts from config', async () => {
    const f = newFetch(httpResponse(500), httpResponse(500), httpResponse(500), httpResponse(500));
    const { client } = setup(f, { maxAttempts: 2 });
    const err = await failure(client.generateStructured(request()));
    expect(err.attempts).toBe(2);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('maxAttempts 1 means no retry', async () => {
    const f = newFetch(httpResponse(500), okResponse());
    const { client, sleep } = setup(f, { maxAttempts: 1 });
    const err = await failure(client.generateStructured(request()));
    expect(err.attempts).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('a non-transient error after a transient one stops retrying', async () => {
    const f = newFetch(httpResponse(503), httpResponse(400), okResponse());
    const { client } = setup(f);
    const err = await failure(client.generateStructured(request()));
    expect(err.code).toBe('http');
    expect(err.status).toBe(400);
    expect(err.attempts).toBe(2);
  });

  it('429 exhausted keeps status 429', async () => {
    const f = newFetch(httpResponse(429), httpResponse(429), httpResponse(429));
    const { client } = setup(f);
    const err = await failure(client.generateStructured(request()));
    expect(err.code).toBe('http');
    expect(err.status).toBe(429);
  });
});

describe('retry delays', () => {
  it('uses exponential backoff baseDelayMs * 2^(n-1)', async () => {
    const f = newFetch(httpResponse(500), httpResponse(500), httpResponse(500), okResponse());
    const { client, sleep } = setup(f, { maxAttempts: 4, baseDelayMs: 1000 });
    await client.generateStructured(request());
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000, 4000]);
  });

  it('scales with baseDelayMs', async () => {
    const f = newFetch(httpResponse(500), httpResponse(500), okResponse());
    const { client, sleep } = setup(f, { baseDelayMs: 250 });
    await client.generateStructured(request());
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([250, 500]);
  });

  it('prefers Retry-After (seconds) over backoff', async () => {
    const f = newFetch(httpResponse(429, { 'retry-after': '7' }), okResponse());
    const { client, sleep } = setup(f);
    await client.generateStructured(request());
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([7000]);
  });

  it('falls back to backoff when Retry-After is not a number of seconds', async () => {
    const f = newFetch(httpResponse(503, { 'retry-after': 'soon' }), okResponse());
    const { client, sleep } = setup(f);
    await client.generateStructured(request());
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000]);
  });

  it('does not sleep after the last attempt', async () => {
    const f = newFetch(httpResponse(500), httpResponse(500), httpResponse(500));
    const { client, sleep } = setup(f);
    await failure(client.generateStructured(request()));
    expect(sleep).toHaveBeenCalledTimes(2);
  });
});

describe('timeout', () => {
  /** A fetch that never resolves on its own and rejects with AbortError when aborted, like real fetch. */
  function hangingFetch() {
    return vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        }),
    );
  }

  it('passes an AbortSignal to fetch', async () => {
    const f = newFetch(okResponse());
    const { client } = setup(f);
    await client.generateStructured(request());
    expect(f.mock.calls[0]![1]!.signal).toBeInstanceOf(AbortSignal);
  });

  it('aborts after timeoutMs and reports timeout (single attempt)', async () => {
    vi.useFakeTimers();
    const f = hangingFetch();
    const client = createModelClient(
      { ...baseConfig, timeoutMs: 45000, maxAttempts: 1 },
      {
        getToken: async () => 't',
        fetch: f as unknown as typeof fetch,
        sleep: async () => {},
        now: fakeNow(),
      },
    );
    const p = failure(client.generateStructured(request()));
    await vi.advanceTimersByTimeAsync(44999);
    expect(f.mock.calls[0]![1]!.signal!.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    const err = await p;
    expect(err.code).toBe('timeout');
    expect(err.attempts).toBe(1);
    expect(f.mock.calls[0]![1]!.signal!.aborted).toBe(true);
  });

  it('a timeout is transient: retried with a fresh signal, then recovers', async () => {
    vi.useFakeTimers();
    let calls = 0;
    const signals: AbortSignal[] = [];
    const f = vi.fn((_url: unknown, init?: RequestInit) => {
      calls++;
      signals.push(init!.signal!);
      if (calls === 2) return Promise.resolve(okResponse());
      return new Promise<Response>((_r, reject) => {
        init!.signal!.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- typed params give mock.calls its tuple type
    const sleep = vi.fn(async (_ms: number) => {});
    const metrics: ModelCallMetrics[] = [];
    const client = createModelClient(
      { ...baseConfig, timeoutMs: 1000, maxAttempts: 3 },
      {
        getToken: async () => 't',
        fetch: f as unknown as typeof fetch,
        sleep,
        now: fakeNow(),
        onMetrics: (m) => metrics.push(m),
      },
    );
    const p = client.generateStructured(request());
    await vi.advanceTimersByTimeAsync(1001);
    const res = await p;
    expect(res.attempts).toBe(2);
    expect(signals[0]).not.toBe(signals[1]);
    expect(signals[0]!.aborted).toBe(true);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(metrics[0]).toMatchObject({ outcome: 'ok', attempts: 2 });
  });

  it('every attempt timing out ends in timeout with attempts = maxAttempts', async () => {
    vi.useFakeTimers();
    const f = hangingFetch();
    const client = createModelClient(
      { ...baseConfig, timeoutMs: 1000, maxAttempts: 2 },
      {
        getToken: async () => 't',
        fetch: f as unknown as typeof fetch,
        sleep: async () => {},
        now: fakeNow(),
      },
    );
    const p = failure(client.generateStructured(request()));
    await vi.advanceTimersByTimeAsync(5000);
    const err = await p;
    expect(err.code).toBe('timeout');
    expect(err.attempts).toBe(2);
    expect(f).toHaveBeenCalledTimes(2);
  });
});

describe('metrics', () => {
  it('is called exactly once on success with outcome ok, attempts, latency and tokens', async () => {
    const f = newFetch(okResponse());
    const { client, metrics } = setup(f);
    await client.generateStructured(request({ requestId: 'req-42' }));
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      requestId: 'req-42',
      deployment: 'dep-test',
      outcome: 'ok',
      attempts: 1,
      promptTokens: 11,
      completionTokens: 7,
      totalTokens: 18,
    });
    expect(metrics[0]!.latencyMs).toBeGreaterThan(0);
  });

  it('takes latency from the injected clock', async () => {
    const f = newFetch(okResponse());
    const times = [1000, 1230];
    const metrics: ModelCallMetrics[] = [];
    const client = createModelClient(baseConfig, {
      getToken: async () => 't',
      fetch: f as unknown as typeof fetch,
      sleep: async () => {},
      now: () => times.shift() ?? 1230,
      onMetrics: (m) => metrics.push(m),
    });
    const res = await client.generateStructured(request());
    expect(metrics[0]!.latencyMs).toBe(230);
    expect(res.latencyMs).toBe(230);
  });

  it('is called exactly once on failure, without token counts', async () => {
    const f = newFetch(httpResponse(400));
    const { client, metrics } = setup(f);
    await failure(client.generateStructured(request()));
    expect(metrics).toHaveLength(1);
    expect(metrics[0]).toMatchObject({
      outcome: 'http',
      attempts: 1,
      deployment: 'dep-test',
      requestId: 'req-1',
    });
    expect(metrics[0]!.promptTokens).toBeUndefined();
    expect(metrics[0]!.totalTokens).toBeUndefined();
  });

  it('is called once per call, not once per attempt', async () => {
    const f = newFetch(httpResponse(500), httpResponse(500), httpResponse(500));
    const { client, metrics } = setup(f);
    await failure(client.generateStructured(request()));
    expect(metrics).toHaveLength(1);
  });

  it('a throwing onMetrics does not change the result', async () => {
    const f = newFetch(okResponse());
    const client = createModelClient(baseConfig, {
      getToken: async () => 't',
      fetch: f as unknown as typeof fetch,
      sleep: async () => {},
      now: fakeNow(),
      onMetrics: () => {
        throw new Error('sink down');
      },
    });
    await expect(client.generateStructured(request())).resolves.toMatchObject({
      output: { answer: 'hi' },
    });
  });

  it('works without onMetrics', async () => {
    const f = newFetch(okResponse());
    const client = createModelClient(baseConfig, {
      getToken: async () => 't',
      fetch: f as unknown as typeof fetch,
      sleep: async () => {},
    });
    await expect(client.generateStructured(request())).resolves.toBeDefined();
  });
});

describe('golden rule 7: no content in metrics, errors or console', () => {
  const MARKER = 'UNIQUE-MARKER-9f3a7c';
  const prompts = {
    system: `system text ${MARKER}`,
    user: `user text ${MARKER} jane.doe@example.test`,
  };

  function spyConsole() {
    return (['log', 'info', 'warn', 'error', 'debug', 'trace'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
  }

  function assertQuiet(spies: ReturnType<typeof spyConsole>) {
    for (const s of spies) expect(JSON.stringify(s.mock.calls)).not.toContain(MARKER);
  }

  it('success path', async () => {
    const spies = spyConsole();
    const f = newFetch(okResponse());
    const { client, metrics } = setup(f);
    await client.generateStructured(request(prompts));
    expect(JSON.stringify(metrics)).not.toContain(MARKER);
    assertQuiet(spies);
  });

  it.each([
    [
      '400 with the prompt echoed in the body',
      () => httpResponse(400, {}, JSON.stringify({ error: { message: `bad ${MARKER}` } })),
    ],
    ['401 with the prompt echoed in the body', () => httpResponse(401, {}, `denied ${MARKER}`)],
    ['500 with the prompt echoed in the body', () => httpResponse(500, {}, `oops ${MARKER}`)],
    ['refusal text', () => completion('', { refusal: `refused ${MARKER}` })],
    ['invalid JSON content', () => completion(`not json ${MARKER}`)],
    ['truncated content', () => completion(`{"answer":"${MARKER}`, { finish_reason: 'length' })],
  ])('failure path: %s', async (_label, make) => {
    const spies = spyConsole();
    const f = newFetch(make(), make(), make());
    const { client, metrics } = setup(f);
    const err = await failure(client.generateStructured(request(prompts)));
    expect(err.message).not.toContain(MARKER);
    expect(err.stack ?? '').not.toContain(MARKER);
    expect(JSON.stringify(metrics)).not.toContain(MARKER);
    assertQuiet(spies);
  });

  it('network error path', async () => {
    const spies = spyConsole();
    const f = newFetch(
      new TypeError(`fetch failed ${MARKER}`),
      new TypeError(`fetch failed ${MARKER}`),
      new TypeError('x'),
    );
    const { client, metrics } = setup(f);
    const err = await failure(client.generateStructured(request(prompts)));
    expect(err.message).not.toContain(MARKER);
    expect(JSON.stringify(metrics)).not.toContain(MARKER);
    assertQuiet(spies);
  });

  it('metrics contain only the documented keys', async () => {
    const f = newFetch(okResponse());
    const { client, metrics } = setup(f);
    await client.generateStructured(request(prompts));
    const allowed = [
      'requestId',
      'deployment',
      'outcome',
      'attempts',
      'latencyMs',
      'promptTokens',
      'completionTokens',
      'totalTokens',
    ];
    expect(Object.keys(metrics[0]!).filter((k) => !allowed.includes(k))).toEqual([]);
  });
});

describe('no key authentication', () => {
  it('never sends an api-key header on any attempt', async () => {
    const f = newFetch(httpResponse(500), okResponse());
    const { client } = setup(f);
    await client.generateStructured(request());
    for (const call of f.mock.calls) {
      expect(new Headers(call[1]!.headers).has('api-key')).toBe(false);
    }
  });
});

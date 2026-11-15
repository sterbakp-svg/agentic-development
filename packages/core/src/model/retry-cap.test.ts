import { describe, expect, it, vi } from 'vitest';
import { createModelClient, ModelError } from '../index';
import { baseConfig, fakeNow, httpResponse, newFetch, okResponse, request } from './test-helpers';

function setup(f: ReturnType<typeof newFetch>) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- typed params give mock.calls its tuple type
  const sleep = vi.fn(async (_ms: number) => {});
  const client = createModelClient(baseConfig, {
    getToken: async () => 't',
    fetch: f as unknown as typeof fetch,
    sleep,
    now: fakeNow(),
  });
  return { client, sleep };
}

describe('retry delay cap', () => {
  it.each<[string, Record<string, string>, number]>([
    ['86400 seconds', { 'retry-after': '86400' }, 429],
    ['more than 2^31-1 ms', { 'retry-after': '3000000' }, 503],
    ['absurdly large number', { 'retry-after': '9'.repeat(400) }, 503],
    ['just above the cap (31 s)', { 'retry-after': '31' }, 429],
    ['retry-after-ms above the cap', { 'retry-after-ms': '30001' }, 429],
  ])('%s: no retry, transient error is returned', async (_label, headers, status) => {
    const f = newFetch(httpResponse(status, headers), okResponse());
    const { client, sleep } = setup(f);
    const err = await client.generateStructured(request()).catch((e: unknown) => e as ModelError);
    expect(err).toBeInstanceOf(ModelError);
    expect(err).toMatchObject({ code: 'http', status, attempts: 1 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each<[string, Record<string, string>, number]>([
    ['exactly the cap', { 'retry-after': '30' }, 30000],
    ['zero', { 'retry-after': '0' }, 0],
    ['retry-after-ms', { 'retry-after-ms': '250' }, 250],
    [
      'retry-after-ms preferred over retry-after',
      { 'retry-after-ms': '250', 'retry-after': '5' },
      250,
    ],
    [
      'invalid retry-after-ms falls back to retry-after',
      { 'retry-after-ms': 'x', 'retry-after': '5' },
      5000,
    ],
  ])('%s: sleeps the requested time', async (_label, headers, expected) => {
    const f = newFetch(httpResponse(429, headers), okResponse());
    const { client, sleep } = setup(f);
    await client.generateStructured(request());
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([expected]);
  });

  it('a minus sign is not a valid delay: falls back to backoff', async () => {
    const f = newFetch(httpResponse(429, { 'retry-after': '-5' }), okResponse());
    const { client, sleep } = setup(f);
    await client.generateStructured(request());
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000]);
  });

  it('the cap comes from config', async () => {
    const f = newFetch(httpResponse(429, { 'retry-after': '5' }), okResponse());
    const client = createModelClient(
      { ...baseConfig, maxRetryDelayMs: 4000 },
      { getToken: async () => 't', fetch: f as unknown as typeof fetch, sleep: async () => {} },
    );
    await expect(client.generateStructured(request())).rejects.toMatchObject({ status: 429 });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

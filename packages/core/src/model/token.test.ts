import { describe, expect, it, vi } from 'vitest';
import { createEntraTokenProvider } from '../index';

const soon = () => Date.now() + 3600_000;

describe('createEntraTokenProvider', () => {
  it('requests the cognitiveservices scope and returns the token string', async () => {
    const credential = {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- typed param gives mock.calls its tuple type
      getToken: vi.fn(async (_scope: string | string[]) => ({
        token: 'tok-1',
        expiresOnTimestamp: soon(),
      })),
    };
    const provider = createEntraTokenProvider(credential);
    await expect(provider()).resolves.toBe('tok-1');
    expect(credential.getToken).toHaveBeenCalledTimes(1);
    const scope = credential.getToken.mock.calls[0]![0];
    expect([scope].flat()).toEqual(['https://cognitiveservices.azure.com/.default']);
  });

  it('asks the credential on every call (the credential caches, not the provider)', async () => {
    const credential = {
      getToken: vi.fn(async () => ({
        token: 't',
        expiresOnTimestamp: soon(),
      })),
    };
    const provider = createEntraTokenProvider(credential);
    await provider();
    await provider();
    expect(credential.getToken).toHaveBeenCalledTimes(2);
  });

  it('rejects with ModelError auth when the credential fails, without leaking its message', async () => {
    const credential = {
      getToken: vi.fn(async (): Promise<never> => {
        throw new Error('credential-detail-marker');
      }),
    };
    const err = await createEntraTokenProvider(credential)().catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'auth' });
    expect((err as Error).message).not.toContain('credential-detail-marker');
  });

  it('rejects with ModelError auth when the credential returns null', async () => {
    const credential = { getToken: vi.fn(async () => null) };
    const err = await createEntraTokenProvider(credential)().catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'auth' });
  });

  it('can be created without arguments (no network at creation)', () => {
    expect(typeof createEntraTokenProvider()).toBe('function');
  });
});

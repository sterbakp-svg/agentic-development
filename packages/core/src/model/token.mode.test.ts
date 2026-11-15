import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const getToken = vi.fn(async () => ({ token: 'tok', expiresOnTimestamp: 0 }));
  return {
    getToken,
    Default: vi.fn(function (this: object) {
      Object.assign(this, { getToken });
    }),
    Managed: vi.fn(function (this: object) {
      Object.assign(this, { getToken });
    }),
  };
});

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: mocks.Default,
  ManagedIdentityCredential: mocks.Managed,
}));

import { createEntraTokenProvider } from '../index';

beforeEach(() => {
  mocks.Default.mockClear();
  mocks.Managed.mockClear();
  mocks.getToken.mockClear();
});

describe('createEntraTokenProvider modes', () => {
  it('managed_identity builds only ManagedIdentityCredential, system-assigned without clientId', async () => {
    await expect(createEntraTokenProvider({ mode: 'managed_identity' })()).resolves.toBe('tok');
    expect(mocks.Managed).toHaveBeenCalledTimes(1);
    expect(mocks.Managed.mock.calls[0]).toEqual([]);
    expect(mocks.Default).not.toHaveBeenCalled();
  });

  it('managed_identity uses the user-assigned client ID when given', async () => {
    await createEntraTokenProvider({ mode: 'managed_identity', clientId: 'client-1' })();
    expect(mocks.Managed.mock.calls[0]).toEqual(['client-1']);
    expect(mocks.Default).not.toHaveBeenCalled();
  });

  it('developer builds DefaultAzureCredential only', async () => {
    await createEntraTokenProvider({ mode: 'developer' })();
    expect(mocks.Default).toHaveBeenCalledTimes(1);
    expect(mocks.Managed).not.toHaveBeenCalled();
  });

  it('builds nothing at creation and builds the credential once', async () => {
    const provider = createEntraTokenProvider({ mode: 'managed_identity' });
    expect(mocks.Managed).not.toHaveBeenCalled();
    await provider();
    await provider();
    expect(mocks.Managed).toHaveBeenCalledTimes(1);
  });

  it('passes the abort signal to the credential', async () => {
    const abortSignal = new AbortController().signal;
    await createEntraTokenProvider({ mode: 'developer' })({ abortSignal });
    expect(mocks.getToken.mock.calls[0]).toEqual([
      'https://cognitiveservices.azure.com/.default',
      { abortSignal },
    ]);
  });
});

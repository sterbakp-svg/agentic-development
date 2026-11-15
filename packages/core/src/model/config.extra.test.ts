import { describe, expect, it } from 'vitest';
import { loadModelConfig, ModelError } from '../index';

const good = {
  AOAI_ENDPOINT: 'https://aoai.example.test',
  AOAI_DEPLOYMENT: 'dep-test',
  AOAI_API_VERSION: '2099-01-01',
};

function catchError(fn: () => unknown): ModelError {
  try {
    fn();
  } catch (e) {
    return e as ModelError;
  }
  throw new Error('expected loadModelConfig to throw');
}

describe('loadModelConfig: auth mode and retry cap', () => {
  it('defaults to managed_identity, no client ID and a 30 s retry cap', () => {
    const c = loadModelConfig(good);
    expect(c.authMode).toBe('managed_identity');
    expect(c.managedIdentityClientId).toBeUndefined();
    expect(c.maxRetryDelayMs).toBe(30000);
  });

  it('reads AOAI_AUTH_MODE developer and AZURE_CLIENT_ID', () => {
    const c = loadModelConfig({ ...good, AOAI_AUTH_MODE: 'developer', AZURE_CLIENT_ID: 'abc' });
    expect(c.authMode).toBe('developer');
    expect(c.managedIdentityClientId).toBe('abc');
  });

  it.each(['key', 'Developer', ''])('rejects AOAI_AUTH_MODE=%j', (value) => {
    const err = catchError(() => loadModelConfig({ ...good, AOAI_AUTH_MODE: value }));
    expect(err.code).toBe('config');
    expect(err.message).toContain('AOAI_AUTH_MODE');
  });
});

describe('loadModelConfig: endpoint shape', () => {
  it('returns the origin', () => {
    expect(
      loadModelConfig({ ...good, AOAI_ENDPOINT: 'https://aoai.example.test:8443/' }).endpoint,
    ).toBe('https://aoai.example.test:8443');
  });

  it.each([
    'https://aoai.example.test/openai',
    'https://aoai.example.test/?x=1',
    'https://aoai.example.test/#frag',
    'https://user:pw-marker@aoai.example.test',
    'https://user@aoai.example.test',
  ])('rejects %s without echoing it', (value) => {
    const err = catchError(() => loadModelConfig({ ...good, AOAI_ENDPOINT: value }));
    expect(err.code).toBe('config');
    expect(err.message).toContain('AOAI_ENDPOINT');
    expect(err.message).not.toContain('pw-marker');
  });
});

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

describe('loadModelConfig', () => {
  it('reads endpoint, deployment and api version and applies defaults', () => {
    expect(loadModelConfig(good)).toEqual({
      endpoint: 'https://aoai.example.test',
      deployment: 'dep-test',
      apiVersion: '2099-01-01',
      timeoutMs: 45000,
      maxAttempts: 3,
      baseDelayMs: 1000,
    });
  });

  it('removes a trailing slash from the endpoint', () => {
    expect(loadModelConfig({ ...good, AOAI_ENDPOINT: 'https://aoai.example.test/' }).endpoint).toBe(
      'https://aoai.example.test',
    );
  });

  it('reads AOAI_TIMEOUT_MS', () => {
    expect(loadModelConfig({ ...good, AOAI_TIMEOUT_MS: '1234' }).timeoutMs).toBe(1234);
  });

  it.each(['AOAI_ENDPOINT', 'AOAI_DEPLOYMENT', 'AOAI_API_VERSION'])(
    'throws ModelError config naming %s when it is missing',
    (name) => {
      const env: Record<string, string | undefined> = { ...good };
      delete env[name];
      const err = catchError(() => loadModelConfig(env));
      expect(err).toBeInstanceOf(ModelError);
      expect(err.code).toBe('config');
      expect(err.message).toContain(name);
    },
  );

  it.each(['AOAI_ENDPOINT', 'AOAI_DEPLOYMENT', 'AOAI_API_VERSION'])(
    'treats an empty %s as missing',
    (name) => {
      const err = catchError(() => loadModelConfig({ ...good, [name]: '' }));
      expect(err.code).toBe('config');
      expect(err.message).toContain(name);
    },
  );

  it('rejects a non-https endpoint and does not echo its value', () => {
    const err = catchError(() =>
      loadModelConfig({ ...good, AOAI_ENDPOINT: 'http://secret-host-marker.example.test' }),
    );
    expect(err.code).toBe('config');
    expect(err.message).toContain('AOAI_ENDPOINT');
    expect(err.message).not.toContain('secret-host-marker');
  });

  it('rejects an endpoint that is not a URL and does not echo its value', () => {
    const err = catchError(() => loadModelConfig({ ...good, AOAI_ENDPOINT: 'not-a-url-marker' }));
    expect(err.code).toBe('config');
    expect(err.message).not.toContain('not-a-url-marker');
  });

  it.each(['abc', '0', '-5', '1.5', ''])('rejects AOAI_TIMEOUT_MS=%j', (value) => {
    const err = catchError(() => loadModelConfig({ ...good, AOAI_TIMEOUT_MS: value }));
    expect(err.code).toBe('config');
    expect(err.message).toContain('AOAI_TIMEOUT_MS');
  });

  it('ignores AOAI_API_KEY completely', () => {
    const withKey = loadModelConfig({ ...good, AOAI_API_KEY: 'key-marker-123' });
    expect(withKey).toEqual(loadModelConfig(good));
    expect(JSON.stringify(withKey)).not.toContain('key-marker-123');
  });
});

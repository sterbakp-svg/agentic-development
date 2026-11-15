import { describe, expect, it } from 'vitest';
import * as core from './index';

describe('core public API', () => {
  it('exports the model client (T-010)', () => {
    for (const name of [
      'loadModelConfig',
      'createEntraTokenProvider',
      'ModelError',
      'createModelClient',
      'toStrictJsonSchema',
    ]) {
      expect(typeof (core as Record<string, unknown>)[name]).toBe('function');
    }
  });
});

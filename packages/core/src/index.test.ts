import { describe, expect, it } from 'vitest';
import * as core from './index';

describe('core public API', () => {
  it('exports the T-003 profile API', () => {
    expect(core.agentProfileSchema).toBeDefined();
    expect(typeof core.prepareProfile).toBe('function');
  });
});

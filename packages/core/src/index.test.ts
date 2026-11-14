import { describe, expect, it } from 'vitest';
import * as core from './index';

describe('core public API', () => {
  it('loads and starts empty', () => {
    expect(Object.keys(core)).toEqual(['x']);
  });
});

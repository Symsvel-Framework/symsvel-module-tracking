import { describe, expect, it } from 'vitest';
import { moduleId } from '../src/lib/modules/tracking';

describe('tracking module', () => {
  it('exports its identifier', () => {
    expect(moduleId).toBe('tracking');
  });
});

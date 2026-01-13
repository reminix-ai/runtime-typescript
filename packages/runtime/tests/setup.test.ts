/**
 * Placeholder test to verify test setup works.
 */

import { describe, it, expect } from 'vitest';

describe('Test Setup', () => {
  it('should verify vitest is configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should import package exports', async () => {
    const { serve, BaseAdapter } = await import('../src/index.js');
    expect(serve).toBeDefined();
    expect(BaseAdapter).toBeDefined();
  });
});

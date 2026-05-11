import { describe, it, expect } from 'vitest';

describe('test environment', () => {
  it('runs vitest with expect available', () => {
    expect(1 + 1).toBe(2);
  });

  it('has DOM globals from jsdom', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });
});

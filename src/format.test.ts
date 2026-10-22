import { describe, expect, it } from 'vitest';
import { formatBRL } from './format';

describe('formatBRL', () => {
  it('formats integer cents as Brazilian reais', () => {
    expect(formatBRL(12345)).toBe('R$ 123,45');
  });
});

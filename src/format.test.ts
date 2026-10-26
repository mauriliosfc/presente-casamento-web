import { describe, expect, it } from 'vitest';
import { formatBRL, maskBRLInput, parseBRLCents } from './format';

describe('formatBRL', () => {
  it('formats integer cents as Brazilian reais', () => {
    expect(formatBRL(12345)).toBe('R$ 123,45');
  });
});

describe('currency input mask', () => {
  it('treats typed digits as cents and formats them as Brazilian currency', () => {
    expect(maskBRLInput('123456')).toBe(formatBRL(123456));
    expect(parseBRLCents(maskBRLInput('123456'))).toBe(123456);
  });

  it('ignores currency punctuation and returns zero for an empty input', () => {
    expect(parseBRLCents('R$ 1.234,56')).toBe(123456);
    expect(parseBRLCents('')).toBe(0);
  });
});

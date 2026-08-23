import { describe, it, expect } from 'vitest';
import { isTypedRef, parseTypedRef, createTypedRef } from '../src/refs.js';

describe('TypedRef Contract', () => {
  it('identifies valid TypedRefs', () => {
    expect(isTypedRef('decision:dec-01')).toBe(true);
    expect(isTypedRef('assumption:asm-02')).toBe(true);
    expect(isTypedRef('gap:gap-03')).toBe(true);
    expect(isTypedRef('conflict:cnf-04')).toBe(true);
    expect(isTypedRef('tension:tns-05')).toBe(true);
    expect(isTypedRef('risk:rsk-06')).toBe(true);
    expect(isTypedRef('question:q-07')).toBe(true);
    expect(isTypedRef('input:inp-08')).toBe(true);
  });

  it('rejects invalid TypedRefs', () => {
    expect(isTypedRef('unknown:123')).toBe(false);
    expect(isTypedRef('decision:')).toBe(false);
    expect(isTypedRef(':dec-01')).toBe(false);
    expect(isTypedRef('no-colon')).toBe(false);
    expect(isTypedRef('')).toBe(false);
  });

  it('correctly parses valid TypedRefs', () => {
    const parsed = parseTypedRef('decision:platform-windows');
    expect(parsed.kind).toBe('decision');
    expect(parsed.id).toBe('platform-windows');
    expect(parsed.raw).toBe('decision:platform-windows');
  });

  it('throws on parsing invalid TypedRef', () => {
    expect(() => parseTypedRef('invalid-ref')).toThrow('Invalid TypedRef format');
  });

  it('creates TypedRefs reliably', () => {
    expect(createTypedRef('gap', 'mvp-scope')).toBe('gap:mvp-scope');
    expect(() => createTypedRef('decision', 'dec:with:colons')).toThrow('Must be non-empty and not contain colons');
  });
});

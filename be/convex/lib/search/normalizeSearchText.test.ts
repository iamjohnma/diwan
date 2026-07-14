import { describe, expect, test } from 'vitest';
import { normalizeSearchText, highlightMatches } from './normalizeSearchText.ts';

describe('normalizeSearchText', () => {
  test('strips Arabic diacritics and tatweel', () => {
    // "مُحَمَّد" with fatha/damma/shadda marks, plus a tatweel-stretched "أحـــمد"
    expect(normalizeSearchText('مُحَمَّد')).toBe('محمد');
    expect(normalizeSearchText('أحـــمد')).toBe('احمد');
  });

  test('unifies Alef variants to bare Alef', () => {
    expect(normalizeSearchText('أحمد')).toBe('احمد');
    expect(normalizeSearchText('إبراهيم')).toBe('ابراهيم');
    expect(normalizeSearchText('آدم')).toBe('ادم');
    expect(normalizeSearchText('ٱحمد')).toBe('احمد');
  });

  test('unifies hamza-on-carrier to the bare carrier letter', () => {
    expect(normalizeSearchText('مؤمن')).toBe('مومن');
    expect(normalizeSearchText('سئل')).toBe('سيل');
  });

  test('folds teh-marbuta to heh', () => {
    expect(normalizeSearchText('فاطمة')).toBe('فاطمه');
  });

  test('strips bare hamza', () => {
    expect(normalizeSearchText('مسؤولء')).not.toContain('ء');
  });

  test('lowercases Latin characters', () => {
    expect(normalizeSearchText('Rani SHWAIKI')).toBe('rani shwaiki');
  });

  test('collapses repeated whitespace and trims', () => {
    expect(normalizeSearchText('  رني    شويكي  ')).toBe('رني شويكي');
  });

  test('drops phone/date-shaped tokens from the normalized text', () => {
    expect(normalizeSearchText('رني 0599123456')).toBe('رني');
    expect(normalizeSearchText('حسن 2026-07-10')).toBe('حسن');
    expect(normalizeSearchText('كريم')).toBe('كريم');
  });

  test('two names differing only by hamza/alef/teh-marbuta variants normalize identically', () => {
    expect(normalizeSearchText('أحمد فاطمة')).toBe(normalizeSearchText('احمد فاطمه'));
  });
});

describe('highlightMatches', () => {
  test('returns the whole original string unmatched when there are no ranges', () => {
    expect(highlightMatches('احمد', [])).toEqual([{ text: 'احمد', matched: false }]);
  });

  test('maps a normalized-space match range back onto the original string', () => {
    // normalizeSearchText('أحمد') === 'احمد' (أ -> ا, same length, 1:1 map)
    // matching normalized[0..4] should map back to the full original string
    const segments = highlightMatches('أحمد', [{ start: 0, end: 4 }]);
    expect(segments).toEqual([{ text: 'أحمد', matched: true }]);
  });

  test('produces unmatched-matched-unmatched segments around a partial match', () => {
    // 'رني شويكي' normalizes 1:1 (no substitutions needed) so byte offsets
    // in normalized space equal offsets in original space here.
    const original = 'رني شويكي';
    const normalized = normalizeSearchText(original);
    const matchStart = normalized.indexOf('شويكي');
    const segments = highlightMatches(original, [
      { start: matchStart, end: matchStart + 'شويكي'.length },
    ]);
    expect(segments).toEqual([
      { text: 'رني ', matched: false },
      { text: 'شويكي', matched: true },
    ]);
  });
});

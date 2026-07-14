const ARABIC_DIACRITICS_AND_TATWEEL = /[ً-ٟـ]/;
const ALEF_VARIANTS = new Set(['أ', 'إ', 'آ', 'ٱ']); // أ إ آ ٱ
const HAMZA_CARRIER_MAP: Record<string, string> = {
  'ؤ': 'و', // ؤ -> و
  'ئ': 'ي', // ئ -> ي
};
const TEH_MARBUTA = 'ة'; // ة
const HEH = 'ه'; // ه
const BARE_HAMZA = 'ء'; // ء
const ALEF = 'ا'; // ا
const PHONE_OR_DATE_TOKEN = /^[\d\-/.:+()]{3,}$/;

interface CharEntry {
  char: string;
  originalIndex: number;
}

/**
 * Decomposes the input via NFKD one code point at a time (not the whole
 * string at once) so each output character can be traced back to the exact
 * UTF-16 offset in the original string it came from — a whole-string
 * normalize() call loses that mapping.
 */
function nfkdWithMap(input: string): CharEntry[] {
  const entries: CharEntry[] = [];
  let originalIndex = 0;
  for (const codePoint of input) {
    const decomposed = codePoint.normalize('NFKD');
    for (const outChar of decomposed) {
      entries.push({ char: outChar, originalIndex });
    }
    originalIndex += codePoint.length; // handles surrogate pairs correctly
  }
  return entries;
}

function substituteAndFilter(entries: CharEntry[]): CharEntry[] {
  const result: CharEntry[] = [];
  for (const entry of entries) {
    const { char, originalIndex } = entry;
    if (ARABIC_DIACRITICS_AND_TATWEEL.test(char)) continue; // strip
    if (char === BARE_HAMZA) continue; // strip
    if (ALEF_VARIANTS.has(char)) {
      result.push({ char: ALEF, originalIndex });
      continue;
    }
    const hamzaTarget = HAMZA_CARRIER_MAP[char];
    if (hamzaTarget) {
      result.push({ char: hamzaTarget, originalIndex });
      continue;
    }
    if (char === TEH_MARBUTA) {
      result.push({ char: HEH, originalIndex });
      continue;
    }
    result.push({ char: char.toLowerCase(), originalIndex });
  }
  return result;
}

function collapseWhitespace(entries: CharEntry[]): CharEntry[] {
  const result: CharEntry[] = [];
  let lastWasSpace = true; // trims leading whitespace for free
  for (const entry of entries) {
    const isSpace = /\s/.test(entry.char);
    if (isSpace) {
      if (!lastWasSpace) result.push({ char: ' ', originalIndex: entry.originalIndex });
      lastWasSpace = true;
    } else {
      result.push(entry);
      lastWasSpace = false;
    }
  }
  while (result.length > 0 && result[result.length - 1]?.char === ' ') result.pop();
  return result;
}

function dropNumericTokens(entries: CharEntry[]): CharEntry[] {
  const tokens: CharEntry[][] = [];
  let current: CharEntry[] = [];
  for (const entry of entries) {
    if (entry.char === ' ') {
      if (current.length > 0) tokens.push(current);
      current = [];
    } else {
      current.push(entry);
    }
  }
  if (current.length > 0) tokens.push(current);

  const kept: CharEntry[] = [];
  for (const token of tokens) {
    const tokenText = token.map((e) => e.char).join('');
    if (PHONE_OR_DATE_TOKEN.test(tokenText)) continue;
    if (kept.length > 0) kept.push({ char: ' ', originalIndex: token[0]?.originalIndex ?? 0 });
    kept.push(...token);
  }
  return kept;
}

export interface NormalizedSearchText {
  normalized: string;
  /** originalIndexOf[i] is the UTF-16 offset in the original string that normalized[i] came from. */
  originalIndexOf: number[];
}

export function normalizeSearchTextWithMap(input: string): NormalizedSearchText {
  const pipeline = dropNumericTokens(
    collapseWhitespace(substituteAndFilter(nfkdWithMap(input))),
  );
  return {
    normalized: pipeline.map((e) => e.char).join(''),
    originalIndexOf: pipeline.map((e) => e.originalIndex),
  };
}

export function normalizeSearchText(input: string): string {
  return normalizeSearchTextWithMap(input).normalized;
}

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export function highlightMatches(
  original: string,
  matchedNormalizedRanges: ReadonlyArray<{ start: number; end: number }>,
): HighlightSegment[] {
  if (matchedNormalizedRanges.length === 0) {
    return [{ text: original, matched: false }];
  }
  const { originalIndexOf } = normalizeSearchTextWithMap(original);

  const originalRanges: Array<{ start: number; end: number }> = [];
  for (const range of matchedNormalizedRanges) {
    const startIdx = originalIndexOf[range.start];
    const lastCharIdx = originalIndexOf[range.end - 1];
    if (startIdx === undefined || lastCharIdx === undefined) continue;
    originalRanges.push({ start: startIdx, end: lastCharIdx + 1 });
  }
  originalRanges.sort((a, b) => a.start - b.start);

  const segments: HighlightSegment[] = [];
  let cursor = 0;
  for (const range of originalRanges) {
    const start = Math.max(range.start, cursor);
    if (start > cursor) segments.push({ text: original.slice(cursor, start), matched: false });
    if (range.end > start) {
      segments.push({ text: original.slice(start, range.end), matched: true });
      cursor = range.end;
    }
  }
  if (cursor < original.length) segments.push({ text: original.slice(cursor), matched: false });
  return segments;
}

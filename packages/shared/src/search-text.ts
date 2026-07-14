export type SearchTextInput = unknown;

export type SearchTextValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | SearchTextValue[]
  | SearchTextField;

export type SearchTextFieldKind = "text" | "phone" | "identifier";

export interface SearchTextField {
  kind: SearchTextFieldKind;
  value: SearchTextValue;
}

export interface SearchTextMatchRange {
  start: number;
  end: number;
}

const ARABIC_DIACRITICS_REGEX =
  /[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g;
const LATIN_COMBINING_MARKS_REGEX = /[\u0300-\u036f]/g;
const TATWEEL_REGEX = /\u0640/g;
const ARABIC_ALEF_VARIANTS_REGEX = /[\u0625\u0623\u0622\u0671]/g;
const WHITESPACE_REGEX = /\s+/g;
const ISO_DATE_TEXT_REGEX = /^\d{4}-\d{1,2}-\d{1,2}(?:[tT\s].*)?$/;
const SLASH_DATE_TEXT_REGEX = /^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/;
const DATE_MONTH_TEXT_REGEX =
  /^(?:\d{1,2}\s+)?(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|يناير|فبراير|مارس|ابريل|أبريل|مايو|يونيو|يوليو|اغسطس|أغسطس|سبتمبر|اكتوبر|أكتوبر|نوفمبر|ديسمبر)(?:\s+\d{1,4})?$/i;
const NUMERIC_TEXT_REGEX = /^[\s+\-()₪$€£.,،٫٬%٠-٩۰-۹0-9]+$/;

const SEARCH_TEXT_FIELD_MARKER = Symbol("searchTextField");

interface SearchTextFieldRecord extends SearchTextField {
  [SEARCH_TEXT_FIELD_MARKER]: true;
}

export function normalizeSearchText(value: SearchTextInput): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .normalize("NFKD")
    .replace(ARABIC_DIACRITICS_REGEX, "")
    .replace(LATIN_COMBINING_MARKS_REGEX, "")
    .replace(TATWEEL_REGEX, "")
    .replace(ARABIC_ALEF_VARIANTS_REGEX, "\u0627")
    .replace(/\u0624/g, "\u0648")
    .replace(/\u0626/g, "\u064a")
    .replace(/\u0649/g, "\u064a")
    .replace(/\u0629/g, "\u0647")
    .replace(/\u0621/g, "")
    .trim()
    .toLowerCase()
    .replace(WHITESPACE_REGEX, " ");
}

export function searchTextIncludes(
  value: SearchTextInput,
  query: SearchTextInput,
): boolean {
  const normalizedQuery = normalizeSearchText(query);

  return (
    normalizedQuery.length === 0 ||
    normalizeSearchText(value).includes(normalizedQuery)
  );
}

export function phoneSearchText(value: SearchTextValue): SearchTextField {
  return {
    [SEARCH_TEXT_FIELD_MARKER]: true,
    kind: "phone",
    value,
  } as SearchTextFieldRecord;
}

export function identifierSearchText(value: SearchTextValue): SearchTextField {
  return {
    [SEARCH_TEXT_FIELD_MARKER]: true,
    kind: "identifier",
    value,
  } as SearchTextFieldRecord;
}

export function buildSearchText(...values: SearchTextValue[]): string {
  const parts: string[] = [];

  visitSearchTextValues(values, "text", (value, kind) => {
    const normalized = normalizeSearchText(value);
    if (
      normalized.length > 0 &&
      (kind === "phone" ||
        kind === "identifier" ||
        isSearchableTextValue(value))
    ) {
      parts.push(normalized);
    }
  });

  return [...new Set(parts)].join(" ");
}

export function buildFieldMatchText(...values: SearchTextValue[]): string {
  const parts: string[] = [];

  visitSearchTextValues(values, "text", (value, kind) => {
    parts.push(
      kind === "phone" || kind === "identifier" || isSearchableTextValue(value)
        ? normalizeSearchText(value)
        : "",
    );
  });

  return parts.join(MATCH_TEXT_SEPARATOR);
}

export const MATCH_TEXT_SEPARATOR = String.fromCharCode(0);

export function findSearchTextMatchRanges(
  value: SearchTextInput,
  query: SearchTextInput,
): SearchTextMatchRange[] {
  const raw = value === null || value === undefined ? "" : String(value);
  const normalizedQuery = normalizeSearchText(query);
  if (raw.length === 0 || normalizedQuery.length === 0) {
    return [];
  }

  const normalizedChars: string[] = [];
  const map: SearchTextMatchRange[] = [];
  for (let index = 0; index < raw.length; index += 1) {
    const rawChar = raw[index];
    if (rawChar === undefined) {
      continue;
    }
    const normalized = normalizeSearchText(rawChar);
    for (let offset = 0; offset < normalized.length; offset += 1) {
      normalizedChars.push(normalized.charAt(offset));
      map.push({ start: index, end: index + 1 });
    }
  }

  const normalizedValue = normalizedChars.join("");
  const ranges: SearchTextMatchRange[] = [];
  let searchFrom = 0;
  while (searchFrom < normalizedValue.length) {
    const matchIndex = normalizedValue.indexOf(normalizedQuery, searchFrom);
    if (matchIndex === -1) {
      break;
    }
    const lastMatchIndex = matchIndex + normalizedQuery.length - 1;
    const start = map[matchIndex]?.start;
    const end = map[lastMatchIndex]?.end;
    if (start !== undefined && end !== undefined && start < end) {
      ranges.push({ start, end });
    }
    searchFrom = matchIndex + Math.max(normalizedQuery.length, 1);
  }

  return ranges;
}

function isSearchTextField(value: SearchTextValue): value is SearchTextField {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as Partial<SearchTextFieldRecord>)[SEARCH_TEXT_FIELD_MARKER] === true
  );
}

function visitSearchTextValues(
  values: SearchTextValue[],
  inheritedKind: SearchTextFieldKind,
  callback: (value: SearchTextValue, kind: SearchTextFieldKind) => void,
) {
  for (const value of values) {
    if (Array.isArray(value)) {
      visitSearchTextValues(value, inheritedKind, callback);
      continue;
    }
    if (isSearchTextField(value)) {
      visitSearchTextValues([value.value], value.kind, callback);
      continue;
    }
    if (value === null || value === undefined) {
      continue;
    }
    callback(value, inheritedKind);
  }
}

function isSearchableTextValue(value: SearchTextValue): boolean {
  if (typeof value !== "string") {
    return false;
  }

  const trimmed = value.trim();
  return (
    trimmed.length > 0 &&
    !isNumericSearchText(trimmed) &&
    !isDateSearchText(trimmed)
  );
}

function isNumericSearchText(value: string): boolean {
  return NUMERIC_TEXT_REGEX.test(value);
}

function isDateSearchText(value: string): boolean {
  return (
    ISO_DATE_TEXT_REGEX.test(value) ||
    SLASH_DATE_TEXT_REGEX.test(value) ||
    DATE_MONTH_TEXT_REGEX.test(value)
  );
}

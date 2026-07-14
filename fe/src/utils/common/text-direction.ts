const RTL_CHAR_RANGES = [
  /[\u0600-\u06FF]/,
  /[\u0750-\u077F]/,
  /[\u08A0-\u08FF]/,
  /[\uFB50-\uFDFF]/,
  /[\uFE70-\uFEFF]/,
  /[\u0590-\u05FF]/,
  /[\uFB1D-\uFB4F]/
];

const RTL_COMBINED_REGEX = new RegExp(
  RTL_CHAR_RANGES.map((r) => r.source).join('|')
);

function hasRtlStrongChars(text: string) {
  return RTL_COMBINED_REGEX.test(text);
}

export function getTextDirection(
  text: string | null | undefined
): 'ltr' | 'rtl' {
  return text && hasRtlStrongChars(text) ? 'rtl' : 'ltr';
}

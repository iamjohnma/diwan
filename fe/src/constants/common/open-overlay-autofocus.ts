// Input types that are not free-text fields and must never be treated as the
// "first text field" to autofocus when an overlay opens. Without these
// exclusions a non-text control rendered before the real text input (e.g. the
// `sr-only` radios inside a `CardSelect`) would silently steal autofocus, and
// nothing visible ends up focused.
const NON_TEXT_INPUT_TYPES = [
  'hidden',
  'radio',
  'checkbox',
  'button',
  'submit',
  'reset',
  'file',
  'image',
  'range',
  'color'
] as const;

const TEXT_INPUT_SELECTOR = `input${NON_TEXT_INPUT_TYPES.map(
  (type) => `:not([type="${type}"])`
).join('')}`;

export const OPEN_OVERLAY_FIRST_INPUT_SELECTOR = `${TEXT_INPUT_SELECTOR}, textarea, [contenteditable="true"]`;

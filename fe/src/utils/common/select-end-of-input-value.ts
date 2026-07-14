const TEXT_INPUT_TYPES = new Set([
  'text',
  'search',
  'url',
  'tel',
  'email',
  'password'
]);

function setCaretToLogicalEnd(element: HTMLTextAreaElement | HTMLInputElement) {
  const length = element.value.length;

  try {
    element.setSelectionRange(length, length, 'none');
  } catch {
    try {
      element.setSelectionRange(length, length);
    } catch {
      void 0;
    }
  }
}
export function selectEndOfInputValue(element: HTMLElement) {
  if (element instanceof HTMLInputElement) {
    if (!TEXT_INPUT_TYPES.has(element.type)) {
      return;
    }

    if (element.hasAttribute('data-autofocus-select-all')) {
      try {
        element.select();
      } catch {
        void 0;
      }

      return;
    }

    setCaretToLogicalEnd(element);

    return;
  }

  if (element instanceof HTMLTextAreaElement) {
    setCaretToLogicalEnd(element);
  }
}

export function scheduleSelectEndAfterControlledUpdate(
  element: HTMLElement
): void {
  const apply = () => {
    selectEndOfInputValue(element);
  };

  requestAnimationFrame(() => {
    apply();
    window.setTimeout(apply, 0);
  });
}

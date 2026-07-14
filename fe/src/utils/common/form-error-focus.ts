import {
  canAutoFocus,
  focusAutoFocusTarget
} from '@/utils/common/can-auto-focus';

const preferredFocusableFormControlSelectors = [
  '[data-focus-target]:not([data-focus-target="false"])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[role="combobox"]:not([aria-disabled="true"])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
] as const;

const focusableFormControlSelector =
  preferredFocusableFormControlSelectors.join(',');

const invalidFormControlSelector =
  '[data-invalid="true"], [aria-invalid="true"]';

function normalizeFieldName(value: string): string {
  return value
    .replace(/\[(\d+)\]/g, '.$1')
    .replace(/\[['"]?([^'"\]]+)['"]?\]/g, '.$1');
}

function getNormalizedFieldNameSet(fieldNames: readonly string[]): Set<string> {
  return new Set(
    fieldNames.filter(Boolean).map((fieldName) => normalizeFieldName(fieldName))
  );
}

function isFocusableControl(element: HTMLElement): boolean {
  if (element.closest('[data-no-focus], [aria-hidden="true"]')) {
    return false;
  }

  if (
    element.getAttribute('aria-disabled') === 'true' ||
    element.getAttribute('disabled') !== null
  ) {
    return false;
  }

  return element.matches(focusableFormControlSelector);
}

function getFocusableControl(element: HTMLElement): HTMLElement | null {
  if (isFocusableControl(element)) {
    return element;
  }

  for (const selector of preferredFocusableFormControlSelectors) {
    const focusable = element.querySelector<HTMLElement>(selector);
    if (focusable && isFocusableControl(focusable)) {
      return focusable;
    }
  }

  return null;
}

function collectFieldNames(element: HTMLElement): string[] {
  const names: string[] = [];
  const ownDataName = element.getAttribute('data-field-name');
  const ownName = element.getAttribute('name');

  if (ownDataName) {
    names.push(ownDataName);
  }

  if (ownName) {
    names.push(ownName);
  }

  element
    .querySelectorAll<HTMLElement>('[data-field-name], [name]')
    .forEach((child) => {
      const dataName = child.getAttribute('data-field-name');
      const name = child.getAttribute('name');

      if (dataName) {
        names.push(dataName);
      }

      if (name) {
        names.push(name);
      }
    });

  return names.map((name) => normalizeFieldName(name));
}

function elementHasFieldName(
  element: HTMLElement,
  fieldNames: Set<string>
): boolean {
  return collectFieldNames(element).some((name) => fieldNames.has(name));
}

function findFirstInvalidMatchingControl(
  formElement: HTMLFormElement,
  fieldNames: Set<string>
): HTMLElement | null {
  for (const element of formElement.querySelectorAll<HTMLElement>(
    invalidFormControlSelector
  )) {
    if (!elementHasFieldName(element, fieldNames)) {
      continue;
    }

    const focusable = getFocusableControl(element);
    if (focusable) {
      return focusable;
    }
  }

  return null;
}

function findFirstNamedControl(
  formElement: HTMLFormElement,
  fieldNames: Set<string>
): HTMLElement | null {
  for (const element of formElement.querySelectorAll<HTMLElement>(
    '[data-field-name], [name]'
  )) {
    if (!elementHasFieldName(element, fieldNames)) {
      continue;
    }

    const focusable = getFocusableControl(element);
    if (focusable) {
      return focusable;
    }
  }

  return null;
}

function findFirstInvalidControl(
  formElement: HTMLFormElement
): HTMLElement | null {
  for (const element of formElement.querySelectorAll<HTMLElement>(
    invalidFormControlSelector
  )) {
    const focusable = getFocusableControl(element);
    if (focusable) {
      return focusable;
    }
  }

  return null;
}

function focusControl(element: HTMLElement): boolean {
  if (!focusAutoFocusTarget(element)) {
    return false;
  }

  return (
    document.activeElement === element ||
    element.contains(document.activeElement)
  );
}

export function focusFirstFormError(
  formElement: HTMLFormElement | null,
  fieldNames: readonly string[] = []
): boolean {
  if (!canAutoFocus() || !formElement) {
    return false;
  }

  const normalizedFieldNames = getNormalizedFieldNameSet(fieldNames);
  const target =
    normalizedFieldNames.size > 0
      ? (findFirstInvalidMatchingControl(formElement, normalizedFieldNames) ??
        findFirstNamedControl(formElement, normalizedFieldNames) ??
        findFirstInvalidControl(formElement))
      : findFirstInvalidControl(formElement);

  return target ? focusControl(target) : false;
}

export function scheduleFocusFirstFormError(
  formElement: HTMLFormElement | null,
  fieldNames: readonly string[] = []
): () => void {
  if (!canAutoFocus() || !formElement) {
    return () => undefined;
  }

  let cancelled = false;
  let secondFrameId: number | null = null;
  const firstFrameId = requestAnimationFrame(() => {
    if (cancelled || focusFirstFormError(formElement, fieldNames)) {
      return;
    }

    secondFrameId = requestAnimationFrame(() => {
      if (!cancelled) {
        focusFirstFormError(formElement, fieldNames);
      }
    });
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(firstFrameId);
    if (secondFrameId !== null) {
      cancelAnimationFrame(secondFrameId);
    }
  };
}

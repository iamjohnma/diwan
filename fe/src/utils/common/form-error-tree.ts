import type { FieldError } from 'react-hook-form';

interface FieldErrorEntry {
  path: string;
  error: FieldError;
}

function isFieldError(value: unknown): value is FieldError {
  return !!(
    value &&
    typeof value === 'object' &&
    ('type' in value || 'message' in value)
  );
}

export function collectFieldErrorEntries(
  value: unknown,
  parentPath = ''
): FieldErrorEntry[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  if (isFieldError(value)) {
    return parentPath ? [{ path: parentPath, error: value }] : [];
  }

  return Object.entries(value).flatMap(([key, childValue]) =>
    collectFieldErrorEntries(
      childValue,
      parentPath ? `${parentPath}.${key}` : key
    )
  );
}

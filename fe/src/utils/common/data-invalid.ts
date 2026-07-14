interface DataInvalidProps {
  'data-invalid'?: boolean | 'true' | 'false';
}

export function isDataInvalid(
  p: DataInvalidProps | Record<string, unknown> | null | undefined
): boolean {
  const value = (p as DataInvalidProps | undefined)?.['data-invalid'];

  return value === true || value === 'true';
}

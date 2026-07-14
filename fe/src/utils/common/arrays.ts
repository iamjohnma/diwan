export function areArraysEqual<T>(
  left: readonly T[] | undefined,
  right: readonly T[] | undefined,
  areItemsEqual?: (left: T, right: T, index: number) => boolean
): boolean {
  return (
    left === right ||
    !!(
      left &&
      right &&
      left.length === right.length &&
      left.every(
        (leftItem, index) =>
          areItemsEqual?.(leftItem, right[index] as T, index) ??
          leftItem === right[index]
      )
    )
  );
}

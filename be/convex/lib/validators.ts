import { v, type Validator } from 'convex/values';

type LiteralValue = string | number | boolean;

// Builds a v.union(v.literal(...), ...) from a shared `as const` array, so an
// enum's values are written exactly once (in packages/shared) and never
// hand-typed again as a Convex validator.
export function literalUnion<const TValues extends readonly [LiteralValue, ...LiteralValue[]]>(
  values: TValues,
): Validator<TValues[number], 'required', never> {
  const literals = values.map((value) => v.literal(value)) as {
    [K in keyof TValues]: Validator<TValues[K], 'required', never>;
  };
  return v.union(...literals) as Validator<TValues[number], 'required', never>;
}

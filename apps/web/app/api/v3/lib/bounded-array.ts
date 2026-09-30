import { z } from "zod";

type TLengthBounds = {
  min?: number;
  max: number;
  /** Advertised in the JSON schema the MCP tools publish, and shown in the OpenAPI reference. */
  description?: string;
  /** Replaces Zod's default `Too small` wording for the lower bound. */
  minMessage?: string;
};

/**
 * `z.array(item).max(n)` parses every element before the `.max()` check runs, so a 2 MB body of junk
 * entries comes back as one issue per element — measured at ~500 MB of transient heap for a 200k-entry
 * `order` — on both surfaces that share these bodies: the REST route, and the MCP tool, whose SDK
 * validates arguments through Zod's `~standard.validate` and collects every issue before the scope
 * gate runs. Checking the length *before* the value reaches the inner schema makes an oversized array
 * cost exactly one issue. A field-level `preprocess` keeps the advertised JSON schema intact (`items`,
 * `minItems` and `maxItems` all survive `z.toJSONSchema`), which a `.pipe()` around the field does not.
 *
 * The route-level array budget (`array-budget.ts`) is the backstop for arrays no schema declares; this
 * is for the ones a schema does declare, where the bound is part of the documented contract.
 */
export function lengthBoundedArray<TItem extends z.ZodType>(item: TItem, bounds: TLengthBounds) {
  const min = bounds.min ?? 0;
  let inner = z
    .array(item)
    .min(min, bounds.minMessage ? { message: bounds.minMessage } : undefined)
    .max(bounds.max);
  if (bounds.description) {
    inner = inner.describe(bounds.description);
  }

  const bounded = z.preprocess((value, ctx) => {
    if (Array.isArray(value) && value.length > bounds.max) {
      ctx.addIssue({
        code: "too_big",
        origin: "array",
        maximum: bounds.max,
        inclusive: true,
        input: value,
        message: `Too big: expected array to have <=${bounds.max} items`,
      });
      return z.NEVER;
    }
    return value;
  }, inner);

  // Described on the outside as well, so `field.description` reads the same as on a plain `z.array`
  // — the tool-description drift tests read it there.
  return bounds.description ? bounded.describe(bounds.description) : bounded;
}

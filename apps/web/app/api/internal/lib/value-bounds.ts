import type { z } from "zod";

/**
 * Field caps for values a schema can't bound where it declares them: inside a recursive tree (segment
 * filters), a record keyed by the caller (response filters), or a shared schema whose fields are too many
 * to rebuild one by one (workspace styling). A route's `superRefine` walks the parsed value and calls
 * these, so a refusal names the field and its limit the way a schema's own `.max()` does.
 */

type TPath = (string | number)[];

/** A string longer than `max` gets an issue at `path`, worded like Zod's own `.max()`. */
export const checkStringMax = (ctx: z.RefinementCtx, value: string, max: number, path: TPath): void => {
  if (value.length <= max) return;
  ctx.addIssue({
    code: "too_big",
    origin: "string",
    maximum: max,
    inclusive: true,
    input: value,
    path,
    message: `Too big: expected string to have <=${max} characters`,
  });
};

/** A number outside `[min, max]`, or a fraction where `int` asks for an integer, gets an issue at `path`. */
export const checkNumberRange = (
  ctx: z.RefinementCtx,
  value: number,
  { min, max, int = false }: { min: number; max: number; int?: boolean },
  path: TPath
): void => {
  if (int && !Number.isInteger(value)) {
    ctx.addIssue({
      code: "invalid_type",
      expected: "int",
      input: value,
      path,
      message: "Invalid input: expected int, received number",
    });
    return;
  }
  if (value > max) {
    ctx.addIssue({
      code: "too_big",
      origin: "number",
      maximum: max,
      inclusive: true,
      input: value,
      path,
      message: `Too big: expected number to be <=${max}`,
    });
  } else if (value < min) {
    ctx.addIssue({
      code: "too_small",
      origin: "number",
      minimum: min,
      inclusive: true,
      input: value,
      path,
      message: `Too small: expected number to be >=${min}`,
    });
  }
};

/** An object or array with more than `max` entries gets an issue at `path`. */
export const checkEntriesMax = (ctx: z.RefinementCtx, value: object, max: number, path: TPath): void => {
  const entries = Array.isArray(value) ? value.length : Object.keys(value).length;
  if (entries <= max) return;
  ctx.addIssue({
    code: "too_big",
    origin: Array.isArray(value) ? "array" : "object",
    maximum: max,
    inclusive: true,
    input: value,
    path,
    message: `Too big: expected ${Array.isArray(value) ? "array" : "object"} to have <=${max} entries`,
  });
};

export const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

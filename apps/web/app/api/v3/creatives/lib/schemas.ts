import { z } from "zod";
import {
  zCreateCreativeRequest,
  zGetCreativeV3Path,
  zPatchCreativeRequest,
} from "@formbricks/api-v3-schemas";
import { ZShowConditions } from "@formbricks/types/show-conditions";

/**
 * The request schemas of the v3 creative routes.
 *
 * The shapes are generated from the contract (`@formbricks/api-v3-schemas`); this module adds only what a
 * generated schema cannot carry:
 *
 * - strictness for the path parameters, which the generator emits stripping;
 * - the Show when rules the contract states in prose (operand/operator fit, value shape, at most 20
 *   conditions, 10 240 characters), checked with the shared `ZShowConditions` so creatives and surveys
 *   accept exactly the same conditions. A breach answers 400, naming the offending condition.
 *
 * Everything that needs the creative's stored state or the database (locales, publish rules, the type of
 * a patched `content`, references) is checked by the operations, and answers 422.
 */

export const ZV3CreativeIdParams = z.strictObject(zGetCreativeV3Path.shape);
export type TV3CreativeIdParams = z.infer<typeof ZV3CreativeIdParams>;

const CONDITIONS_PATH = ["distribution", "conditions"] as const;

const refineShowConditions = (
  distribution: { conditions: unknown } | undefined,
  ctx: z.RefinementCtx
): void => {
  if (!distribution?.conditions) return;
  const parsed = ZShowConditions.safeParse(distribution.conditions);
  if (parsed.success) return;
  for (const issue of parsed.error.issues) {
    ctx.addIssue({ code: "custom", message: issue.message, path: [...CONDITIONS_PATH, ...issue.path] });
  }
};

/**
 * PostgreSQL stores neither a `text` nor a `jsonb` string holding U+0000, so a body carrying one would
 * fail its write with a 500. `JSON.stringify` writes that character as the escape below, and nothing
 * else in a body can produce the escape, so one scan of the serialized body finds it at any depth.
 */
const refineNoNullBytes = (body: unknown, ctx: z.RefinementCtx): void => {
  if (JSON.stringify(body).includes(String.raw`\u0000`)) {
    ctx.addIssue({ code: "custom", message: "Text must not contain NULL bytes", path: [] });
  }
};

export const ZV3CreateCreativeBody = zCreateCreativeRequest.superRefine((body, ctx) => {
  refineNoNullBytes(body, ctx);
  refineShowConditions(body.distribution, ctx);
});
export type TV3CreateCreativeBody = z.infer<typeof ZV3CreateCreativeBody>;

export const ZV3PatchCreativeBody = zPatchCreativeRequest.superRefine((body, ctx) => {
  refineNoNullBytes(body, ctx);
  refineShowConditions(body.distribution, ctx);
});
export type TV3PatchCreativeBody = z.infer<typeof ZV3PatchCreativeBody>;

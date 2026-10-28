import { z } from "zod";
import { ZV3ActionClassResource } from "@/app/api/v3/action-classes/schemas";
import { ZV3ContactAttributeKeyResource } from "@/app/api/v3/contact-attribute-keys/schemas";
import { ZV3SurveyLifecycleResource } from "@/app/api/v3/surveys/lifecycle-schemas";
import { mcpToolOutput } from "./output-schemas";

/**
 * What the lifecycle and reference tools answer with, built from the v3 resource schemas. Apart from
 * `lifecycle-schemas.ts` for the same reason as `creative-output-schemas.ts`: input schemas are held to
 * "no open object" by `schemas.test.ts`, the shared error envelope is deliberately loose.
 */

// These two lists answer `meta: { limit, nextCursor }` only: no total count, so the shared list `meta`
// (which requires one) is replaced rather than satisfied.
const ZMcpReferenceListMeta = z.object({ limit: z.number().int(), nextCursor: z.string().nullable() });

export const ZMcpActionClassListOutput = mcpToolOutput(ZV3ActionClassResource.array()).extend({
  meta: ZMcpReferenceListMeta.optional(),
});

export const ZMcpContactAttributeKeyListOutput = mcpToolOutput(ZV3ContactAttributeKeyResource.array()).extend(
  {
    meta: ZMcpReferenceListMeta.optional(),
  }
);

export const ZMcpSurveyLifecycleOutput = mcpToolOutput(ZV3SurveyLifecycleResource);

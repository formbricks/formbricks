import { z } from "zod";
import { zCreativeListMeta, zCreativeResource, zCreativeStats } from "@formbricks/api-v3-schemas";
import { mcpToolOutput } from "./output-schemas";

/**
 * What the creative tools answer with, built from the generated v3 resource schemas and never retyped: a
 * hand-written copy is a second contract that drifts from the serializer, and the SDK fails every call
 * that would otherwise have succeeded.
 *
 * Their own file, apart from `creative-schemas.ts`, because that one is held to "no open object" by
 * `schemas.test.ts` and the shared error envelope's `invalid_params` items are deliberately loose.
 */

export const ZMcpCreativeOutput = mcpToolOutput(zCreativeResource);

// A creative list's `meta` is the limit and cursor only: the survey and response lists' `totalCount` is
// not on this contract, so the shared envelope's `meta` is replaced rather than satisfied.
export const ZMcpCreativeListOutput = mcpToolOutput(z.array(zCreativeResource)).extend({
  meta: zCreativeListMeta.optional(),
});

export const ZMcpCreativeStatsOutput = mcpToolOutput(zCreativeStats);

/** A delete answers 204: no `data`, just the request id. */
export { ZMcpAcknowledgement as ZMcpCreativeDeleteOutput } from "./output-schemas";

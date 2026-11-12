import { z } from "zod";
import type { TV3Tag } from "@/app/api/v3/tags/serializers";
import { mcpToolOutput } from "./output-schemas";

/** Output schemas for the tag tools, apart from the inputs so the strict-input test covers only inputs. */

/**
 * `TagResource` from the OpenAPI document. It has no generated Zod schema, so it is typed against the
 * serializer's `TV3Tag`: a field the serializer adds or drops fails the typecheck here.
 */
const ZMcpTagResource = z
  .object({
    id: z.string(),
    name: z.string(),
    workspaceId: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    count: z.number().int(),
  })
  .loose() satisfies z.ZodType<TV3Tag>;

export const ZMcpTagListOutput = mcpToolOutput(z.array(ZMcpTagResource));
export const ZMcpTagOutput = mcpToolOutput(ZMcpTagResource);
export const ZMcpTagMergeOutput = mcpToolOutput(z.object({ id: z.string() }).loose());

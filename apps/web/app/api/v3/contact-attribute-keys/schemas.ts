import { z } from "zod";
import { ZContactAttributeDataType, ZContactAttributeKeyType } from "@formbricks/types/contact-attribute-key";

/** A contact attribute key as the v3 API answers it, so MCP output schemas derive from it instead of retyping the shape. */
export const ZV3ContactAttributeKeyResource = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  type: ZContactAttributeKeyType,
  dataType: ZContactAttributeDataType,
});

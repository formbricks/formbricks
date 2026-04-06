import { z } from "zod";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";
import { isSafeIdentifier } from "@/lib/utils/safe-identifier";
import { ZGetFilter } from "@/modules/api/v2/types/api-filter";

export const ZGetContactAttributeKeysFilter = ZGetFilter.extend({
  environmentId: z.cuid2().optional().describe("The environment ID to filter by"),
})
  .refine(
    (data) => {
      if (data.startDate && data.endDate && data.startDate > data.endDate) {
        return false;
      }
      return true;
    },
    {
      message: "startDate must be before endDate",
    }
  )
  .describe("Filter for retrieving contact attribute keys");

export type TGetContactAttributeKeysFilter = z.infer<typeof ZGetContactAttributeKeysFilter>;

export const ZContactAttributeKeyInput = ZContactAttributeKey.pick({
  key: true,
  name: true,
  description: true,
  environmentId: true,
  workspaceId: true,
})
  .extend({
    dataType: ZContactAttributeKey.shape.dataType.optional(),
  })
  .superRefine((data, ctx) => {
    // Enforce safe identifier format for key
    if (!isSafeIdentifier(data.key)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter",
        path: ["key"],
      });
    }
  })
  .meta({
    id: "contactAttributeKeyInput",
    description: "Input data for creating or updating a contact attribute",
  });

export type TContactAttributeKeyInput = z.infer<typeof ZContactAttributeKeyInput>;

// Route-level schema that accepts either environmentId or workspaceId
export const ZContactAttributeKeyCreateInput = ZContactAttributeKey.pick({
  key: true,
  name: true,
  description: true,
})
  .extend({
    environmentId: z.cuid2().optional(),
    workspaceId: z.cuid2().optional(),
    dataType: ZContactAttributeKey.shape.dataType.optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.environmentId && !data.workspaceId) {
      ctx.addIssue({
        code: "custom",
        message: "Either environmentId or workspaceId must be provided",
        path: ["environmentId"],
      });
    }
    if (!isSafeIdentifier(data.key)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter",
        path: ["key"],
      });
    }
  })
  .meta({
    id: "contactAttributeKeyCreateInput",
    description: "Input data for creating a contact attribute key (accepts workspaceId or environmentId)",
  });

export type TContactAttributeKeyCreateInput = z.infer<typeof ZContactAttributeKeyCreateInput>;

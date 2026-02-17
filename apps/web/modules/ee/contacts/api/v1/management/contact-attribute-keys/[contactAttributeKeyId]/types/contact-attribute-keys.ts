import { z } from "zod";
import { ZContactAttributeDataType } from "@formbricks/types/contact-attribute-key";
import { isSafeIdentifier } from "@/lib/utils/safe-identifier";

export const ZContactAttributeKeyCreateInput = z.object({
  key: z.string().refine((val) => isSafeIdentifier(val), {
    message:
      "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter",
  }),
  description: z.string().optional(),
  type: z.enum(["custom"]),
  dataType: ZContactAttributeDataType.optional(),
  environmentId: z.string(),
  name: z.string().optional(),
});
export type TContactAttributeKeyCreateInput = z.infer<typeof ZContactAttributeKeyCreateInput>;

export const ZContactAttributeKeyUpdateInput = z.object({
  description: z.string().optional(),
  name: z.string().optional(),
  key: z
    .string()
    .refine((val) => isSafeIdentifier(val), {
      message:
        "Key must be a safe identifier: only lowercase letters, numbers, and underscores, and must start with a letter",
    })
    .optional(),
  dataType: ZContactAttributeDataType.optional(),
});

export type TContactAttributeKeyUpdateInput = z.infer<typeof ZContactAttributeKeyUpdateInput>;

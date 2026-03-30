import { z } from "zod";

export const ZContactAttributeKeyType = z.enum(["default", "custom"]);

export type TContactAttributeKeyType = z.infer<typeof ZContactAttributeKeyType>;

export const ZContactAttributeDataType = z.enum(["string", "number", "date"]);

export type TContactAttributeDataType = z.infer<typeof ZContactAttributeDataType>;

export const ZContactAttributeKey = z.object({
  id: z.cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  isUnique: z.boolean().prefault(false),
  key: z.string(),
  name: z.string().nullable(),
  description: z.string().nullable(),
  type: ZContactAttributeKeyType,
  dataType: ZContactAttributeDataType.prefault("string"),
  environmentId: z.string(),
});

export type TContactAttributeKey = z.infer<typeof ZContactAttributeKey>;

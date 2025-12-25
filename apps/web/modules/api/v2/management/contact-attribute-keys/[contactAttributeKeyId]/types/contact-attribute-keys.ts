import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";

extendZodWithOpenApi(z);

export const ZContactAttributeKeyIdSchema = z
  .string()
  .cuid2()
  .openapi({
    ref: "contactAttributeKeyId",
    description: "The ID of the contact attribute key",
    param: {
      name: "id",
      in: "path",
    },
  });

export const ZContactAttributeKeyUpdateSchema = ZContactAttributeKey.pick({
  name: true,
  description: true,
}).openapi({
  ref: "contactAttributeKeyUpdate",
  description: "A contact attribute key to update. Key cannot be changed.",
});

export type TContactAttributeKeyUpdateSchema = z.infer<typeof ZContactAttributeKeyUpdateSchema>;

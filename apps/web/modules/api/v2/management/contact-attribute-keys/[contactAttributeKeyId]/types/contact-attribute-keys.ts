import { z } from "zod";
import { ZContactAttributeKey } from "@formbricks/database/zod/contact-attribute-keys";

export const ZContactAttributeKeyIdSchema = z
  .cuid2()
  .meta({
    id: "contactAttributeKeyId",
    param: {
      name: "id",
      in: "path",
    },
  })
  .describe("The ID of the contact attribute key");

export const ZContactAttributeKeyUpdateSchema = ZContactAttributeKey.pick({
  name: true,
  description: true,
}).meta({
  id: "contactAttributeKeyUpdate",
  description: "A contact attribute key to update. Key cannot be changed.",
});

export type TContactAttributeKeyUpdateSchema = z.infer<typeof ZContactAttributeKeyUpdateSchema>;

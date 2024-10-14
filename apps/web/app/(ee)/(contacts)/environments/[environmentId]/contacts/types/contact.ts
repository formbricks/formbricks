import { z } from "zod";
import { ZAttributes } from "@formbricks/types/attributes";

export const ZContact = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: z.string().cuid2(),
});

export const ZContactTableData = z.object({
  id: z.string(),
  userId: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  attributes: ZAttributes,
});

export const ZPersonWithAttributes = ZContact.extend({
  attributes: ZAttributes,
});

export type TContactWithAttributes = z.infer<typeof ZPersonWithAttributes>;

export type TContactTableData = z.infer<typeof ZContactTableData>;

export type TContact = z.infer<typeof ZContact>;

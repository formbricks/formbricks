import { z } from "zod";
import { ZAttributes } from "./attributes";

export const ZPerson = z.object({
  id: z.string().cuid2(),
  createdAt: z.date(),
  updatedAt: z.date(),
  environmentId: z.string().cuid2(),
});

export const ZPersonTableData = z.object({
  personId: z.string(),
  createdAt: z.date(),
  userId: z.string(),
  attributes: ZAttributes,
});

export const ZPersonWithAttributes = ZPerson.extend({
  attributes: ZAttributes,
});

export type TPersonWithAttributes = z.infer<typeof ZPersonWithAttributes>;

export type TPersonTableData = z.infer<typeof ZPersonTableData>;

export type TPerson = z.infer<typeof ZPerson>;

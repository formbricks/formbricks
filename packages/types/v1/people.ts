import z from "zod";

export const ZPersonAttributes = z.record(z.union([z.string(), z.number()]));
export type TPersonAttributes = z.infer<typeof ZPersonAttributes>;

export const ZPerson = z.object({
  id: z.string().cuid2(),
  attributes: ZPersonAttributes,
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type TPerson = z.infer<typeof ZPerson>;

export const ZPersonDetailedAttribute = z.object({
  id: z.string().cuid2(),
  name: z.string(),
  value: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  archived: z.boolean(),
});
export type TPersonDetailedAttribute = z.infer<typeof ZPersonDetailedAttribute>;

export const ZPersonWithDetailedAttributes = z.object({
  id: z.string().cuid2(),
  attributes: z.array(ZPersonDetailedAttribute),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type TPersonWithDetailedAttributes = z.infer<typeof ZPersonWithDetailedAttributes>;

export const selectPersonSchemaFromPrisma = {
  id: true,
  createdAt: true,
  updatedAt: true,
  attributes: {
    select: {
      value: true,
      attributeClass: {
        select: {
          name: true,
        },
      },
    },
  },
};
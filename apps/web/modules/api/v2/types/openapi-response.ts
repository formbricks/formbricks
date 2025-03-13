import { z } from "zod";

export function responseWithMetaSchema<T extends z.ZodTypeAny>(contentSchema: T) {
  return z.object({
    data: z.array(contentSchema).optional(),
    meta: z
      .object({
        total: z.number().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      })
      .optional(),
  });
}

// We use the partial method to make all properties optional so we don't show the response fields as required in the OpenAPI documentation
export function makePartialSchema<T extends z.ZodObject<any>>(schema: T) {
  return schema.partial();
}

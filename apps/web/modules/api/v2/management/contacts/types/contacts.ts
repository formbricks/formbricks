import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";
import { ZContact } from "@formbricks/database/zod/contact";

extendZodWithOpenApi(z);

export const ZGetContactsFilter = z
  .object({
    limit: z.coerce.number().positive().min(1).max(100).optional().default(10),
    skip: z.coerce.number().nonnegative().optional().default(0),
    sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
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
  );

export const ZContactInput = ZContact.pick({
  userId: true,
  environmentId: true,
})
  .partial({
    userId: true,
  })
  .openapi({
    ref: "contactCreate",
    description: "A contact to create",
  });

export type TContactInput = z.infer<typeof ZContactInput>;

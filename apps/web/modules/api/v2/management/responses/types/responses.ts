import { z } from "zod";
import { ZResponse } from "@formbricks/database/zod/responses";

export const ZGetResponsesFilter = z
  .object({
    limit: z.coerce.number().positive().min(1).max(100).optional().default(10),
    skip: z.coerce.number().nonnegative().optional().default(0),
    sortBy: z.enum(["createdAt", "updatedAt"]).optional().default("createdAt"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    surveyId: z.string().cuid2().optional(),
    contactId: z.string().optional(),
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

export type TGetResponsesFilter = z.infer<typeof ZGetResponsesFilter>;

export const ZResponseInput = ZResponse.pick({
  createdAt: true,
  updatedAt: true,
  surveyId: true,
  displayId: true,
  singleUseId: true,
  finished: true,
  endingId: true,
  language: true,
  data: true,
  variables: true,
  ttc: true,
  meta: true,
}).partial({
  displayId: true,
  singleUseId: true,
  endingId: true,
  language: true,
  variables: true,
  ttc: true,
  meta: true,
  createdAt: true,
  updatedAt: true,
});

export type TResponseInput = z.infer<typeof ZResponseInput>;

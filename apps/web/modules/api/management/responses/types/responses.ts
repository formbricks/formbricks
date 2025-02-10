import { z } from "zod";
import { ZResponse } from "@formbricks/database/zod/responses";

export const ZGetResponsesFilter = z.object({
  surveyId: z.string().cuid2().optional(),
  limit: z.coerce.number().default(10).optional(),
  skip: z.coerce.number().default(0).optional(),
  sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt").optional(),
  order: z.enum(["asc", "desc"]).default("asc").optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  contactId: z.string().optional(),
});

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
})
  .partial({
    displayId: true,
    singleUseId: true,
    endingId: true,
    language: true,
    variables: true,
    ttc: true,
    meta: true,
  })
  .extend({
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
  });

export type TResponseInput = z.infer<typeof ZResponseInput>;

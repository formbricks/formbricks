import { ZGetFilter } from "@/modules/api/v2/types/api-filter";
import { z } from "zod";
import { ZResponse } from "@formbricks/database/zod/responses";

export const ZGetResponsesFilter = ZGetFilter.extend({
  surveyId: z.string().cuid2().optional(),
  contactId: z.string().optional(),
}).refine(
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

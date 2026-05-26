import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { ZSurveyFilters, ZSurveyStatus, ZSurveyType } from "@formbricks/types/surveys/types";

export const ZMcpListSurveysInput = z.object({
  workspaceId: ZId,
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().min(1).optional(),
  includeTotalCount: z.boolean().default(true),
  filter: z
    .object({
      name: z
        .object({
          contains: z.string().max(512).optional(),
        })
        .optional(),
      status: z
        .object({
          in: z.array(ZSurveyStatus).optional(),
        })
        .optional(),
      type: z
        .object({
          in: z.array(ZSurveyType).optional(),
        })
        .optional(),
    })
    .optional(),
  sortBy: ZSurveyFilters.shape.sortBy.optional(),
});

export const ZMcpDeleteSurveyInput = z.object({
  surveyId: z.cuid2(),
});

export type TMcpListSurveysInput = z.infer<typeof ZMcpListSurveysInput>;
export type TMcpDeleteSurveyInput = z.infer<typeof ZMcpDeleteSurveyInput>;

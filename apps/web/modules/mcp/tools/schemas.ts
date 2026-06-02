import { z } from "zod";
import type { TV3CreateSurveyBody, TV3SurveyValidationRequestBody } from "@/app/api/v3/surveys/schemas";
import { ZV3CreateSurveyBody, ZV3SurveyValidationRequestBody } from "@/app/api/v3/surveys/schemas";
import { ZId } from "@formbricks/types/common";
import { ZSurveyFilters, ZSurveyStatus, ZSurveyType } from "@formbricks/types/surveys/types";

export const ZMcpListSurveysInput = z.object({
  workspaceId: ZId.describe("Workspace ID whose surveys should be listed."),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .describe("Maximum number of surveys to return. Defaults to 20.")
    .default(20),
  cursor: z
    .string()
    .min(1)
    .optional()
    .describe("Opaque pagination cursor from a previous list_surveys response."),
  includeTotalCount: z
    .boolean()
    .describe("Whether to include the total matching survey count in the response metadata. Defaults to true.")
    .default(true),
  filter: z
    .object({
      name: z
        .object({
          contains: z.string().max(512).optional().describe("Case-insensitive survey name substring."),
        })
        .describe("Filter by survey name.")
        .optional(),
      status: z
        .object({
          in: z
            .array(ZSurveyStatus)
            .optional()
            .describe("Survey statuses to include, for example draft or inProgress."),
        })
        .describe("Filter by survey status.")
        .optional(),
      type: z
        .object({
          in: z.array(ZSurveyType).optional().describe("Survey types to include, for example link."),
        })
        .describe("Filter by survey type.")
        .optional(),
    })
    .describe("Optional supported v3 survey filters.")
    .optional(),
  sortBy: ZSurveyFilters.shape.sortBy
    .optional()
    .describe("Sort field for pagination. Defaults to the v3 API default of updatedAt."),
});

export const ZMcpGetSurveyInput = z.object({
  surveyId: z.cuid2().describe("Survey ID to fetch."),
  lang: z
    .array(z.string().trim().min(1))
    .optional()
    .describe("Optional language codes or configured aliases used to filter translatable survey fields."),
});

export const ZMcpCreateSurveyInput = ZV3CreateSurveyBody.describe(
  "Create a block-based link survey using the v3 survey document contract."
);

export const ZMcpPatchSurveyInput = z.object({
  surveyId: z.cuid2().describe("Survey ID to update."),
  data: z
    .record(z.string(), z.unknown())
    .describe(
      "Strict top-level v3 survey patch payload. Omitted top-level fields are preserved; provided objects and arrays replace that whole subtree."
    ),
});

export const ZMcpValidateSurveyInput = ZV3SurveyValidationRequestBody.describe(
  "Validate a v3 survey create or patch payload without writing survey changes."
);

export const ZMcpDeleteSurveyInput = z.object({
  surveyId: z.cuid2().describe("Survey ID to delete."),
});

export type TMcpListSurveysInput = z.infer<typeof ZMcpListSurveysInput>;
export type TMcpGetSurveyInput = z.infer<typeof ZMcpGetSurveyInput>;
export type TMcpCreateSurveyInput = TV3CreateSurveyBody;
export type TMcpPatchSurveyInput = z.infer<typeof ZMcpPatchSurveyInput>;
export type TMcpValidateSurveyInput = TV3SurveyValidationRequestBody;
export type TMcpDeleteSurveyInput = z.infer<typeof ZMcpDeleteSurveyInput>;

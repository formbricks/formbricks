import { z } from "zod";
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
    .describe(
      "Whether to include the total matching survey count in the response metadata. Defaults to true."
    )
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

const ZMcpSurveyLanguageInput = z.object({
  code: z.string().trim().min(1).describe("Language code or configured language alias."),
  default: z.boolean().optional().describe("Whether this language is the default language."),
  enabled: z.boolean().optional().describe("Whether this language is enabled."),
});

const ZMcpObjectInput = z.record(z.string(), z.unknown());

export const ZMcpCreateSurveyInput = z.object({
  workspaceId: ZId.describe("Workspace ID where the survey should be created."),
  name: z.string().trim().min(1).describe("Survey name."),
  type: z.literal("link").optional().describe("Survey type. Only link surveys are supported."),
  status: ZSurveyStatus.optional().describe("Initial survey status. Defaults to draft."),
  defaultLanguage: z
    .string()
    .trim()
    .min(1)
    .optional()
    .describe("Default language code or configured language alias. Defaults to en-US."),
  metadata: ZMcpObjectInput.optional().describe("Survey metadata using the v3 survey document contract."),
  languages: z
    .array(ZMcpSurveyLanguageInput)
    .optional()
    .describe("Configured survey languages using the v3 survey document contract."),
  welcomeCard: ZMcpObjectInput.optional().describe("Welcome card using the v3 survey document contract."),
  blocks: z.array(ZMcpObjectInput).min(1).describe("Survey blocks using the v3 survey document contract."),
  endings: z
    .array(ZMcpObjectInput)
    .optional()
    .describe("Survey endings using the v3 survey document contract."),
  hiddenFields: ZMcpObjectInput.optional().describe("Hidden fields using the v3 survey document contract."),
  variables: z
    .array(ZMcpObjectInput)
    .optional()
    .describe("Survey variables using the v3 survey document contract."),
});

export const ZMcpPatchSurveyInput = z.object({
  surveyId: z.cuid2().describe("Survey ID to update."),
  data: z
    .record(z.string(), z.unknown())
    .describe(
      "Strict top-level v3 survey patch payload. Omitted top-level fields are preserved; provided objects and arrays replace that whole subtree."
    ),
});

export const ZMcpValidateSurveyInput = z.object({
  operation: z.enum(["create", "patch"]).describe("Validation operation to run."),
  surveyId: z.cuid2().optional().describe("Survey ID to validate against. Required for patch validation."),
  data: ZMcpObjectInput.describe(
    "Create or patch payload to validate using the v3 survey document contract."
  ),
});

export const ZMcpDeleteSurveyInput = z.object({
  surveyId: z.cuid2().describe("Survey ID to delete."),
});

// list_workspaces takes no arguments — it returns the workspaces the authenticated caller can access.
export const ZMcpListWorkspacesInput = z.object({});

export type TMcpListSurveysInput = z.infer<typeof ZMcpListSurveysInput>;
export type TMcpListWorkspacesInput = z.infer<typeof ZMcpListWorkspacesInput>;
export type TMcpGetSurveyInput = z.infer<typeof ZMcpGetSurveyInput>;
export type TMcpCreateSurveyInput = z.infer<typeof ZMcpCreateSurveyInput>;
export type TMcpPatchSurveyInput = z.infer<typeof ZMcpPatchSurveyInput>;
export type TMcpValidateSurveyInput = z.infer<typeof ZMcpValidateSurveyInput>;
export type TMcpDeleteSurveyInput = z.infer<typeof ZMcpDeleteSurveyInput>;

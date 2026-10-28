import { z } from "zod";
import { V3_LIST_DEFAULT_LIMIT, V3_LIST_MAX_LIMIT } from "@/app/api/v3/lib/cursor-pagination";
import { ZV3SurveyGenerateBody } from "@/app/api/v3/surveys/generate/schemas";
import { ZV3SurveyVisibilityBody } from "@/app/api/v3/surveys/visibility/schemas";

/**
 * Input schemas for the survey lifecycle and reference tools: archive, restore, visibility, AI draft
 * generation, and the two workspace reference lists (action classes, contact attribute keys) an app survey
 * is wired to. Strict like every other tool input (ENG-2256); the write inputs extend the v3 body schemas.
 */

const surveyIdField = z.cuid2().describe("Survey ID. Use list_surveys to discover ids.");

/**
 * The two reference lists share one shape: a workspace, a page size and a cursor. `limit` is not the
 * v3 query's: that one coerces a string, which an MCP client sending a number has no use for.
 */
const referenceListInput = (what: string) =>
  z.strictObject({
    workspaceId: z.cuid2().describe(`Workspace ID whose ${what} should be listed.`),
    limit: z
      .number()
      .int()
      .min(1)
      .max(V3_LIST_MAX_LIMIT)
      .default(V3_LIST_DEFAULT_LIMIT)
      .describe(`Maximum number of ${what} to return. Defaults to ${V3_LIST_DEFAULT_LIMIT}.`),
    cursor: z
      .string()
      .min(1)
      .optional()
      .describe("Opaque pagination cursor from a previous response's meta."),
  });

export const ZMcpListActionClassesInput = referenceListInput("action classes");
export const ZMcpListContactAttributeKeysInput = referenceListInput("contact attribute keys");

export const ZMcpArchiveSurveyInput = z.strictObject({ surveyId: surveyIdField });
export const ZMcpRestoreSurveyInput = z.strictObject({ surveyId: surveyIdField });
export const ZMcpGetSurveyVisibilityInput = z.strictObject({ surveyId: surveyIdField });

export const ZMcpSetSurveyVisibilityInput = ZV3SurveyVisibilityBody.extend({
  surveyId: surveyIdField,
  visibility: ZV3SurveyVisibilityBody.shape.visibility.describe(
    "`workspace` lets everyone with access to the workspace see the survey; `restricted` limits it to its owner and the organization's owners and managers. Read get_survey_visibility first: `allowedTargets` lists what would act now and `blockers` what refuses `restricted`."
  ),
}).strict();

export const ZMcpGenerateSurveyInput = ZV3SurveyGenerateBody.extend({
  workspaceId: z.cuid2().describe("Workspace ID the draft is for. Needs write access to it."),
  prompt: ZV3SurveyGenerateBody.shape.prompt.describe(
    "What the survey is for: its goal, audience or topic, in at least a sentence (about 24 characters and 4 words) and at most 1200 characters."
  ),
  type: ZV3SurveyGenerateBody.shape.type.describe(
    "`link` (default) or `app`. An app draft carries no triggers or targeting: add them afterwards."
  ),
  language: ZV3SurveyGenerateBody.shape.language.describe(
    "Preferred language code such as en-US or de-DE, used only when the prompt's own language is unclear."
  ),
  surveyLanguage: ZV3SurveyGenerateBody.shape.surveyLanguage.describe(
    "Required language code: the draft is written in it whatever language the prompt is in."
  ),
}).strict();

export type TMcpListActionClassesInput = z.infer<typeof ZMcpListActionClassesInput>;
export type TMcpListContactAttributeKeysInput = z.infer<typeof ZMcpListContactAttributeKeysInput>;
export type TMcpArchiveSurveyInput = z.infer<typeof ZMcpArchiveSurveyInput>;
export type TMcpRestoreSurveyInput = z.infer<typeof ZMcpRestoreSurveyInput>;
export type TMcpGetSurveyVisibilityInput = z.infer<typeof ZMcpGetSurveyVisibilityInput>;
export type TMcpSetSurveyVisibilityInput = z.infer<typeof ZMcpSetSurveyVisibilityInput>;
export type TMcpGenerateSurveyInput = z.infer<typeof ZMcpGenerateSurveyInput>;

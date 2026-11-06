import "server-only";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import type { TFormbricksFileReferences } from "@/modules/survey/formbricks-file/envelope";
import { getFormbricksFileSurveyLanguageCodes } from "@/modules/survey/formbricks-file/fit";
import { previewFormbricksFileImport } from "@/modules/survey/formbricks-file/import";
import type { TFormbricksFileRead } from "@/modules/survey/formbricks-file/read";
import {
  buildFormbricksFileMatch,
  findFormbricksFileMatch,
  hasSurveyResponses,
} from "@/modules/survey/formbricks-file/update";
import type { TSurveyImportFileDraft } from "@/modules/survey/import/core/draft";
import type { TSurveyImportPipelineIssue } from "@/modules/survey/import/core/report";
import type { TSurveyImportMatch, TSurveyImportSourceKind } from "@/modules/survey/import/types";
import type { TSurveyImportLane, TSurveyImportResult, TSurveyImportTarget } from "../core/lane";
import { buildSurveyImportReport } from "../core/report";

/**
 * What the stream route hands the Formbricks file lane: the read of the file (`readFormbricksFile`, in
 * the upload's thread), its name, where it goes, and who imports it — whose language names the draft,
 * and whose rights decide whether the file's survey is offered as a Match.
 */
export interface TFormbricksFileImportInput {
  read: () => Promise<TFormbricksFileRead>;
  fileName: string;
  workspaceId: string;
  organizationId: string;
  authentication: TV3Authentication;
  /**
   * The survey the import was started from, in its menu (ENG-6809): the Match is that survey, whatever
   * survey the file names. Absent for New survey › Import, which matches the file's own source.
   */
  target?: TSurveyImportTarget;
}

export interface TPreparedFormbricksFileImport {
  draft: TSurveyImportFileDraft;
  references: TFormbricksFileReferences;
  issues: TSurveyImportPipelineIssue[];
  match: TSurveyImportMatch | null;
  fileName: string;
}

/** The hidden field ids a copied draft declares, for the report's summary. */
const getHiddenFieldIds = (draft: Record<string, unknown>): string[] => {
  const { hiddenFields } = draft;
  if (typeof hiddenFields !== "object" || hiddenFields === null || !("fieldIds" in hiddenFields)) return [];
  const { fieldIds } = hiddenFields;
  return Array.isArray(fieldIds) ? fieldIds.filter((id): id is string => typeof id === "string") : [];
};

/**
 * The Formbricks file lane (ENG-6850): a file Formbricks wrote, read by code alone. No AI, so it is not
 * held to the organization's AI gate, is charged to the default v3 bucket only, and its deadline is not
 * stretched by `AI_TIMEOUT_MULTIPLIER`.
 *
 * Everything that can refuse the file — its format, its shape, the create's checks, a workspace that
 * cannot hold its attribute keys — runs in `prepare`, so a refusal is a 422 naming each field rather than
 * an error in the stream.
 */
export const formbricksFileImportLane: TSurveyImportLane<
  TFormbricksFileImportInput,
  TPreparedFormbricksFileImport
> = {
  kind: "formbricks",
  usesAI: false,
  rateLimit: null,
  prepare: async ({ read, fileName, workspaceId, organizationId, authentication, target }) => {
    const { draft, references, issues, source, plan } = await previewFormbricksFileImport({
      read: await read(),
      workspaceId,
      organizationId,
      userId: getSessionUserId(authentication),
    });
    const match = target
      ? await buildFormbricksFileMatch({
          survey: target.survey,
          hasResponses: await hasSurveyResponses(target.survey.id),
          // The file's export time only when it was exported from this survey: "changed since the
          // export" means nothing for another survey's file, which is checked against the survey as read now.
          exportedUpdatedAt:
            source?.surveyId === target.survey.id ? source.updatedAt : target.survey.updatedAt.toISOString(),
          draft,
          plan,
        })
      : await findFormbricksFileMatch({
          source,
          workspaceId,
          actor: getV3AuthorizationActor(authentication),
          draft,
          plan,
        });
    return { draft, references, issues, match, fileName };
  },
  run: ({ prepared, onProgress }) => {
    onProgress("assembling");
    return Promise.resolve(toFormbricksFileImportResult(prepared, "formbricks"));
  },
};

/**
 * The stream's result for a draft in a Formbricks file's shape: a Formbricks file's, or an Excel export
 * applied to its survey (ENG-6809), whose draft is that survey as a Formbricks file.
 */
export const toFormbricksFileImportResult = (
  { draft, references, issues, match, fileName }: TPreparedFormbricksFileImport,
  kind: TSurveyImportSourceKind
): TSurveyImportResult => ({
  payload: draft,
  references,
  match,
  report: buildSurveyImportReport({
    source: { kind, fileName },
    document: {
      blocks: draft.blocks,
      languages: getFormbricksFileSurveyLanguageCodes(draft).map((code) => ({ code })),
      hiddenFields: { fieldIds: getHiddenFieldIds(draft) },
    },
    issues,
  }),
});

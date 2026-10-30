import "server-only";
import { getV3AuthorizationActor } from "@/app/api/v3/lib/auth";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import type { TFormbricksFileReferences } from "@/modules/survey/formbricks-file/envelope";
import { getFormbricksFileSurveyLanguageCodes } from "@/modules/survey/formbricks-file/fit";
import { previewFormbricksFileImport } from "@/modules/survey/formbricks-file/import";
import { findFormbricksFileMatch } from "@/modules/survey/formbricks-file/update";
import type { TSurveyImportFileDraft } from "@/modules/survey/import/core/draft";
import type { TSurveyImportPipelineIssue } from "@/modules/survey/import/core/report";
import type { TSurveyImportMatch } from "@/modules/survey/import/types";
import type { TSurveyImportLane } from "../core/lane";
import { buildSurveyImportReport } from "../core/report";

/**
 * What the stream route hands the Formbricks file lane: the parsed file, its name, where it goes, and
 * who imports it — whose language names the draft, and whose rights decide whether the file's survey
 * is offered as a Match.
 */
export interface TFormbricksFileImportInput {
  file: Record<string, unknown>;
  fileName: string;
  workspaceId: string;
  organizationId: string;
  authentication: TV3Authentication;
}

interface TPreparedFormbricksFileImport {
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
  prepare: async ({ file, fileName, workspaceId, organizationId, authentication }) => {
    const { draft, references, issues, source, plan } = await previewFormbricksFileImport({
      file,
      workspaceId,
      organizationId,
      userId: getSessionUserId(authentication),
    });
    const match = await findFormbricksFileMatch({
      source,
      workspaceId,
      actor: getV3AuthorizationActor(authentication),
      draft,
      plan,
    });
    return { draft, references, issues, match, fileName };
  },
  run: async ({ prepared, onProgress }) => {
    onProgress("assembling");
    const { draft, references, issues, match, fileName } = prepared;
    return {
      payload: draft,
      references,
      match,
      report: buildSurveyImportReport({
        source: { kind: "formbricks", fileName },
        document: {
          blocks: draft.blocks,
          languages: getFormbricksFileSurveyLanguageCodes(draft).map((code) => ({ code })),
          hiddenFields: { fieldIds: getHiddenFieldIds(draft) },
        },
        issues,
      }),
    };
  },
};

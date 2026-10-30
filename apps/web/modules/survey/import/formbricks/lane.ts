import "server-only";
import { getFormbricksFileSurveyLanguageCodes } from "@/modules/survey/formbricks-file/fit";
import {
  type TFormbricksFileImportPreview,
  previewFormbricksFileImport,
} from "@/modules/survey/formbricks-file/import";
import type { TSurveyImportLane } from "../core/lane";
import { buildSurveyImportReport } from "../core/report";

/** What the stream route hands the Formbricks file lane: the parsed file, its name, and where it goes. */
export interface TFormbricksFileImportInput {
  file: Record<string, unknown>;
  fileName: string;
  workspaceId: string;
  organizationId: string;
  userId: string | null;
}

interface TPreparedFormbricksFileImport extends TFormbricksFileImportPreview {
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
  prepare: async ({ file, fileName, workspaceId, organizationId, userId }) => ({
    ...(await previewFormbricksFileImport({ file, workspaceId, organizationId, userId })),
    fileName,
  }),
  run: async ({ prepared, onProgress }) => {
    onProgress("assembling");
    const { draft, references, issues, fileName } = prepared;
    return {
      payload: draft,
      references,
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

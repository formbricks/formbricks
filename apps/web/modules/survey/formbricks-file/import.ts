import "server-only";
import { prisma } from "@formbricks/database";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { createV3Survey } from "@/app/api/v3/surveys/create";
import { isPlainObject } from "@/app/api/v3/surveys/guards";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { ZV3CreateSurveyBody, formatV3ZodInvalidParams } from "@/app/api/v3/surveys/schemas";
import { runInSurveyWriteTransaction } from "@/lib/survey/write-transaction";
import { getIsContactsEnabled } from "@/modules/ee/license-check/lib/utils";
import { getDefaultEndingTexts } from "@/modules/survey/import/core/default-ending";
import type { TSurveyImportFileDraft } from "@/modules/survey/import/core/draft";
import { SurveyImportInputError } from "@/modules/survey/import/core/errors";
import { checkImportDraft } from "@/modules/survey/import/core/final-gate";
import {
  type TImporterTranslate,
  getImportedSurveyName,
  getImporterTranslate,
} from "@/modules/survey/import/core/imported-survey-name";
import type { TSurveyImportPipelineIssue } from "@/modules/survey/import/core/report";
import { getExternalUrlsPermission } from "@/modules/survey/lib/permission";
import type { TFormbricksFileReferences, TFormbricksFileSource } from "./envelope";
import {
  type TFormbricksFileFitContext,
  fitFormbricksFileSurvey,
  getFormbricksFileSurveyLanguageCodes,
  hasFormbricksFileRedirectEnding,
} from "./fit";
import { type TFormbricksFileRead, readFormbricksFile, readFormbricksFileContent } from "./read";
import {
  type TFormbricksFileReferencePlan,
  applyFormbricksFileReferences,
  linkFormbricksFileSharedFields,
  planFormbricksFileReferences,
} from "./resolve";

/**
 * Importing a Formbricks file as a new survey (ENG-6850): the preview the dialog reviews, and the
 * create it commits. Both run the same steps on what they are given — read and check the file, remove
 * what the workspace cannot hold, name the draft, resolve its references — so the commit trusts nothing
 * the preview or the client resolved. No AI is involved.
 */

/** The report's note on what a Formbricks file leaves out on purpose. */
const CONTENT_ONLY_NOTE: TSurveyImportPipelineIssue = { code: "content_only", severity: "info" };

const hasTargetingFilters = (survey: Record<string, unknown>): boolean =>
  survey.type === "app" &&
  isPlainObject(survey.targeting) &&
  Array.isArray(survey.targeting.filters) &&
  survey.targeting.filters.length > 0;

/** What the organization's plan lets the survey keep, looked up only when the survey has the part. */
const getFitContext = async (
  survey: Record<string, unknown>,
  organizationId: string
): Promise<TFormbricksFileFitContext> => {
  const [allowExternalUrls, allowTargeting] = await Promise.all([
    getExternalUrlsPermission(organizationId),
    hasTargetingFilters(survey) ? getIsContactsEnabled(organizationId) : Promise.resolve(true),
  ]);

  if (allowExternalUrls || !hasFormbricksFileRedirectEnding(survey)) {
    return { allowExternalUrls, allowTargeting, defaultEndingTexts: {} };
  }
  const codes = getFormbricksFileSurveyLanguageCodes(survey);
  const texts = await getDefaultEndingTexts(codes);
  return {
    allowExternalUrls,
    allowTargeting,
    defaultEndingTexts: Object.fromEntries(codes.map((code, index) => [code, texts[index] ?? null])),
  };
};

/** Problems the create's checks found, named from where the survey sits: `file.survey…` or `survey…`. */
export const nameFromSurvey = (params: InvalidParam[], fieldPrefix: string | null): InvalidParam[] => {
  const root = fieldPrefix ? `${fieldPrefix}.survey` : "survey";
  return params.map((param) => ({
    ...param,
    name: ["data", "body", ""].includes(param.name) ? root : `${root}.${param.name}`,
  }));
};

export const refuseDraft = (invalidParams: InvalidParam[]): SurveyImportInputError =>
  new SurveyImportInputError(invalidParams, "The Formbricks file is not valid.", "formbricks_file_invalid");

/**
 * The draft a read file becomes in a workspace: fitted to what the workspace can hold, a draft, and held
 * to every check the create runs without a database — logic and recall references included. Given a
 * `t`, it is named as a new survey ("<name> (imported)"); without one it keeps the file's name, which
 * an Update never writes.
 */
export const prepareFormbricksFileDraft = async ({
  read,
  workspaceId,
  organizationId,
  fieldPrefix,
  t,
}: {
  read: TFormbricksFileRead;
  workspaceId: string;
  organizationId: string;
  fieldPrefix: string | null;
  t: TImporterTranslate | null;
}): Promise<{ draft: TSurveyImportFileDraft; issues: TSurveyImportPipelineIssue[] }> => {
  const fitted = fitFormbricksFileSurvey(
    read.content.survey,
    await getFitContext(read.content.survey, organizationId)
  );
  const sourceName = typeof fitted.survey.name === "string" ? fitted.survey.name : "";
  const draft: TSurveyImportFileDraft = {
    ...fitted.survey,
    workspaceId,
    name: t ? await getImportedSurveyName(workspaceId, sourceName, t) : sourceName,
    status: "draft",
    blocks: Array.isArray(fitted.survey.blocks) ? fitted.survey.blocks : [],
  };

  const problems = checkImportDraft(draft);
  if (problems.length > 0) throw refuseDraft(nameFromSurvey(problems, fieldPrefix));

  return { draft, issues: [...read.issues, ...fitted.issues] };
};

export interface TFormbricksFileImportPreview {
  /** The survey to review, as the create request body takes it. */
  draft: TSurveyImportFileDraft;
  /** The file's references, which the dialog sends back with the draft to create it. */
  references: TFormbricksFileReferences;
  issues: TSurveyImportPipelineIssue[];
  /** The survey the file was exported from, for finding a Match (ENG-6851). */
  source: TFormbricksFileSource | null;
  /** How the references resolve in the workspace, which a Match compares the survey's triggers with. */
  plan: TFormbricksFileReferencePlan;
}

/**
 * Preview an uploaded Formbricks file as a new survey in a workspace: everything the commit will do,
 * read-only. The references are resolved too, so the report can say what the import creates.
 *
 * @throws SurveyImportInputError — a 422 naming each problem, before anything is written.
 */
export const previewFormbricksFileImport = async ({
  file,
  workspaceId,
  organizationId,
  userId,
}: {
  file: Record<string, unknown>;
  workspaceId: string;
  organizationId: string;
  /** The importing user, whose language names the draft. */
  userId: string | null;
}): Promise<TFormbricksFileImportPreview> => {
  const read = readFormbricksFile(file);
  const t = await getImporterTranslate(userId);
  const { draft, issues } = await prepareFormbricksFileDraft({
    read,
    workspaceId,
    organizationId,
    fieldPrefix: "file",
    t,
  });
  const plan = await planFormbricksFileReferences(prisma, {
    workspaceId,
    survey: draft,
    references: read.content.references,
    t,
    fieldPrefix: "file",
  });

  return {
    draft,
    references: read.content.references,
    issues: [...issues, ...plan.issues, CONTENT_ONLY_NOTE],
    source: read.source,
    plan,
  };
};

/** The draft with each trigger pointing at the target's action class instead of the file's. */
export const withTargetTriggers = (
  draft: TSurveyImportFileDraft,
  actionClassIds: ReadonlyMap<string, string>
): TSurveyImportFileDraft => {
  if (!isPlainObject(draft.distribution) || !Array.isArray(draft.distribution.triggers)) return draft;
  return {
    ...draft,
    distribution: {
      ...draft.distribution,
      triggers: draft.distribution.triggers.map((trigger: unknown) => {
        const sourceId = isPlainObject(trigger) ? trigger.actionClassId : undefined;
        const targetId = typeof sourceId === "string" ? actionClassIds.get(sourceId) : undefined;
        if (!targetId) throw new Error("A trigger's action class was not resolved");
        return { actionClassId: targetId };
      }),
    },
  };
};

/**
 * Create a survey from a reviewed Formbricks file import: the survey and its references the dialog
 * sends back, read, checked, fitted, named and resolved again, then created with the references it
 * needs in one transaction. If anything fails, nothing is left behind.
 *
 * @throws SurveyImportInputError — a 422 naming each problem, nothing created.
 * @throws whatever the v3 create throws, mapped by its caller like `POST /api/v3/surveys`.
 */
export const createSurveyFromFormbricksFile = async ({
  body,
  workspaceId,
  organizationId,
  authentication,
  requestId,
}: {
  body: { survey: unknown; references: unknown };
  workspaceId: string;
  organizationId: string;
  authentication: TV3Authentication;
  requestId: string;
}): Promise<TSurvey> => {
  const read = readFormbricksFileContent(body);
  const t = await getImporterTranslate(getSessionUserId(authentication));
  const { draft } = await prepareFormbricksFileDraft({
    read,
    workspaceId,
    organizationId,
    fieldPrefix: null,
    t,
  });

  return await runInSurveyWriteTransaction(async (transaction) => {
    const plan = await planFormbricksFileReferences(transaction.tx, {
      workspaceId,
      survey: draft,
      references: read.content.references,
      t,
      fieldPrefix: null,
    });
    const actionClassIds = await applyFormbricksFileReferences(transaction.tx, workspaceId, plan);

    const parsed = ZV3CreateSurveyBody.safeParse(withTargetTriggers(draft, actionClassIds));
    if (!parsed.success)
      throw refuseDraft(nameFromSurvey(formatV3ZodInvalidParams(parsed.error, "data"), null));

    const embeddedFields = await linkFormbricksFileSharedFields(transaction.tx, {
      workspaceId,
      variables: parsed.data.variables,
      hiddenFields: parsed.data.hiddenFields,
      sharedFields: read.content.references.embeddedFields,
    });

    return await createV3Survey(parsed.data, authentication, requestId, organizationId, {
      transaction,
      ...(embeddedFields ? { surveyCreateInputOverrides: { embeddedFields } } : {}),
    });
  });
};

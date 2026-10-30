import "server-only";
import { prisma } from "@formbricks/database";
import type { Prisma } from "@formbricks/database/prisma";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import type { TSurvey, TSurveyStatus } from "@formbricks/types/surveys/types";
import { getV3CustomCssPrincipal } from "@/app/api/v3/lib/custom-css-rate-limit";
import type { TV3Authentication } from "@/app/api/v3/lib/types";
import { surveyToV3Distribution } from "@/app/api/v3/surveys/distribution";
import { isPlainObject } from "@/app/api/v3/surveys/guards";
import { getSessionUserId } from "@/app/api/v3/surveys/lib/operations";
import { V3SurveyArchivedError, assertV3SurveyPrecondition, patchV3Survey } from "@/app/api/v3/surveys/patch";
import { V3SurveyReferenceValidationError } from "@/app/api/v3/surveys/reference-validation";
import { ZV3CreateSurveyBody, formatV3ZodInvalidParams } from "@/app/api/v3/surveys/schemas";
import { type TAuthorizationActor, can } from "@/lib/authorization";
import { selectSurveyWithCustomCss } from "@/lib/survey/service";
import { transformPrismaSurvey } from "@/lib/survey/utils";
import { runInSurveyWriteTransaction } from "@/lib/survey/write-transaction";
import { isAppSurveyBlockedFromPublishing } from "@/modules/ee/creatives/lib/survey-publish";
import type { TSurveyImportFileDraft } from "@/modules/survey/import/core/draft";
import { getImporterTranslate } from "@/modules/survey/import/core/imported-survey-name";
import type {
  TSurveyImportMatch,
  TSurveyImportTriggersChoice,
  TSurveyImportTriggersState,
} from "@/modules/survey/import/types";
import type { TFormbricksFileReferences, TFormbricksFileSource } from "./envelope";
import { nameFromSurvey, prepareFormbricksFileDraft, refuseDraft, withTargetTriggers } from "./import";
import { readFormbricksFileContent } from "./read";
import {
  type TFormbricksFileReferencePlan,
  applyFormbricksFileReferences,
  linkFormbricksFileSharedFields,
  planFormbricksFileReferences,
} from "./resolve";
import { getFormbricksFileRemovals } from "./update-diff";

/**
 * Updating a survey from a Formbricks file (ENG-6851, decisions 8, 10, 11, 14 and 22): the Match the
 * preview offers, and the Update it commits.
 *
 * An Update replaces the survey's content with the file's and keeps everything else: its id, status,
 * responses, name, settings and styling. It never writes an active survey, and never writes over edits
 * made since the file was exported unless the user says so ("Update anyway"), which is checked against
 * the survey as the review read it instead.
 */

/**
 * What an Update writes: the content a Formbricks file carries. Never `name`, `status`, `metadata` (the
 * link survey's share settings) or `customCss` (styling). `type` and `defaultLanguage` are sent as the
 * v3 patch takes them — checked against the survey, so a file of another type or default language is
 * refused naming the field rather than half-applied. The file's triggers go only when the user chose
 * them, and never its display settings: those are the survey's settings (see `toUpdatePatch`).
 */
const UPDATE_CONTENT_KEYS = [
  "type",
  "defaultLanguage",
  "languages",
  "showLanguageSwitch",
  "autoSelectLanguage",
  "welcomeCard",
  "blocks",
  "endings",
  "hiddenFields",
  "variables",
  "targeting",
] as const;

/** The survey is active: an Update never writes over a survey that is collecting responses. */
export class SurveyImportUpdateActiveError extends Error {
  constructor() {
    super("Active surveys cannot be updated from a file");
    this.name = "SurveyImportUpdateActiveError";
  }
}

/** The action class ids the draft's triggers name, in the file's ids. */
const getDraftTriggerIds = (draft: Record<string, unknown>): string[] => {
  const distribution = isPlainObject(draft.distribution) ? draft.distribution : {};
  return (Array.isArray(distribution.triggers) ? distribution.triggers : [])
    .map((trigger: unknown) => (isPlainObject(trigger) ? trigger.actionClassId : undefined))
    .filter((id): id is string => typeof id === "string");
};

/**
 * Whether the file's triggers, resolved in the workspace, are the survey's, and if not whether the
 * user may take them: not when they would leave a live app survey with nothing to show it.
 */
const getTriggersState = async ({
  survey,
  draft,
  plan,
  currentActionClassIds,
}: {
  survey: { id: string; workspaceId: string; type: TSurvey["type"]; status: TSurveyStatus };
  draft: Record<string, unknown>;
  plan: TFormbricksFileReferencePlan;
  currentActionClassIds: ReadonlySet<string>;
}): Promise<TSurveyImportTriggersState> => {
  if (survey.type !== "app") return "same";

  const targets = [...new Set(getDraftTriggerIds(draft))].map((id) => plan.actionClasses.get(id));
  // An action the import would create is one the survey cannot have yet.
  const targetIds = targets.flatMap((target) => (target && "id" in target ? [target.id] : []));
  const same =
    targetIds.length === targets.length &&
    targetIds.length === currentActionClassIds.size &&
    targetIds.every((id) => currentActionClassIds.has(id));
  if (same) return "same";

  const blocked = await isAppSurveyBlockedFromPublishing({
    surveyId: survey.id,
    workspaceId: survey.workspaceId,
    type: survey.type,
    status: survey.status,
    triggers: targets,
  });
  return blocked ? "keep_only" : "differ";
};

/**
 * The Match for a previewed file: the survey it was exported from, if that survey is in `workspaceId`,
 * not archived, and one `actor` may edit. Anything else is `null`, the same as a survey that never
 * existed, so the preview cannot be used to learn about surveys the user cannot see.
 *
 * The caller has already checked that the user may write in the workspace.
 */
export const findFormbricksFileMatch = async ({
  source,
  workspaceId,
  actor,
  draft,
  plan,
}: {
  source: TFormbricksFileSource | null;
  workspaceId: string;
  actor: TAuthorizationActor | null;
  /** The fitted draft, in the file's action class ids. */
  draft: TSurveyImportFileDraft;
  plan: TFormbricksFileReferencePlan;
}): Promise<TSurveyImportMatch | null> => {
  if (!source || !actor) return null;

  const survey = await prisma.survey.findFirst({
    where: { id: source.surveyId, workspaceId, archivedAt: null },
    select: {
      id: true,
      workspaceId: true,
      name: true,
      type: true,
      status: true,
      updatedAt: true,
      blocks: true,
      triggers: { select: { actionClassId: true } },
      responses: { select: { id: true }, take: 1 },
    },
  });
  if (!survey) return null;
  if (!(await can(actor, "survey.write", { type: "survey", id: survey.id }))) return null;

  const triggers = await getTriggersState({
    survey,
    draft,
    plan,
    currentActionClassIds: new Set(survey.triggers.map((trigger) => trigger.actionClassId)),
  });

  return {
    surveyId: survey.id,
    name: survey.name,
    status: survey.status,
    updatedAt: survey.updatedAt.toISOString(),
    exportedUpdatedAt: source.updatedAt,
    triggers,
    issues: survey.responses.length > 0 ? getFormbricksFileRemovals(survey.blocks, draft.blocks) : [],
  };
};

/** The survey's row, held until the transaction ends: under read committed, later reads see it as locked. */
const lockSurvey = async (
  tx: Prisma.TransactionClient,
  surveyId: string,
  workspaceId: string
): Promise<{ status: TSurveyStatus; updatedAt: Date; archivedAt: Date | null } | null> => {
  // NO KEY UPDATE, like any UPDATE of the row: it waits for and blocks other writers of the survey —
  // a status change included — without blocking the responses and displays whose keys point at it.
  const [row] = await tx.$queryRaw<{ status: TSurveyStatus; updatedAt: Date; archivedAt: Date | null }[]>`
    SELECT status, "updated_at" AS "updatedAt", "archivedAt" FROM "Survey"
    WHERE id = ${surveyId} AND "workspaceId" = ${workspaceId} FOR NO KEY UPDATE`;
  return row ?? null;
};

/** The draft without its triggers and display settings, for an Update that keeps the survey's. */
const withoutDistribution = (draft: TSurveyImportFileDraft): TSurveyImportFileDraft => {
  const { distribution: _distribution, ...rest } = draft;
  return rest;
};

/**
 * What the v3 patch receives: the file's content keys and, when the draft still has a `distribution` —
 * which it does only when the user chose the file's triggers — its triggers alone. The v3 patch replaces
 * `distribution` whole, so it is sent with the survey's own display settings (how often and when it
 * shows, its auto-close and response limit, its show conditions) and the file's triggers. As with any
 * patch that sends `distribution`, a draft's unfinished show-condition rows are not kept.
 */
const toUpdatePatch = (draft: Record<string, unknown>, survey: TSurvey): Record<string, unknown> => {
  const patch = Object.fromEntries(
    UPDATE_CONTENT_KEYS.filter((key) => key in draft).map((key) => [key, draft[key]])
  );
  if (!isPlainObject(draft.distribution)) return patch;
  return {
    ...patch,
    distribution: { ...surveyToV3Distribution(survey), triggers: draft.distribution.triggers },
  };
};

/**
 * The survey's hidden fields and variables with the shared ones the file brings linked to the
 * workspace's library, as the create links them; `undefined` when none links, so the patch keeps every
 * field the survey's own. The draft is read as the create body to type its fields.
 */
const linkSharedFields = async (
  tx: Prisma.TransactionClient,
  {
    workspaceId,
    draft,
    sharedFields,
  }: {
    workspaceId: string;
    draft: TSurveyImportFileDraft;
    sharedFields: TFormbricksFileReferences["embeddedFields"];
  }
): Promise<TLinkedEmbeddedField[] | undefined> => {
  if (sharedFields.length === 0) return undefined;
  const parsed = ZV3CreateSurveyBody.safeParse(draft);
  if (!parsed.success)
    throw refuseDraft(nameFromSurvey(formatV3ZodInvalidParams(parsed.error, "data"), null));
  return linkFormbricksFileSharedFields(tx, {
    workspaceId,
    variables: parsed.data.variables,
    hiddenFields: parsed.data.hiddenFields,
    sharedFields,
  });
};

export interface TFormbricksFileUpdateBody {
  /** The reviewed survey and the file's references, as the preview returned them. */
  survey: Record<string, unknown>;
  references: Record<string, unknown>;
  /**
   * The survey's `updatedAt` the Update is made against: the file's export time, or for "Update anyway"
   * the time the review read. The survey must not have changed since.
   */
  updatedAt: string;
  triggers: TSurveyImportTriggersChoice;
}

/**
 * Update a survey from a reviewed Formbricks file import, in one transaction with the references it
 * needs. The survey is locked first, so its status and `updatedAt` are checked against the row the
 * write replaces: a survey that went live, or changed, after the review is refused, and nothing —
 * not even a reference — is written.
 *
 * @param survey The survey as the caller authorized it, for its workspace; its content is read again
 *   under the lock.
 * @throws SurveyImportUpdateActiveError — the survey is active (422).
 * @throws V3SurveyStaleError — the survey changed since `body.updatedAt` (409, with the current one).
 * @throws SurveyImportInputError — the file is not valid for this survey, naming each field (422).
 * @throws whatever the v3 patch throws, mapped by its caller like `PATCH /api/v3/surveys/{id}`.
 */
export const updateSurveyFromFormbricksFile = async ({
  survey: authorizedSurvey,
  body,
  organizationId,
  authentication,
  visibleSurveyWhere,
  requestId,
}: {
  survey: Pick<TSurvey, "id" | "workspaceId">;
  body: TFormbricksFileUpdateBody;
  organizationId: string;
  authentication: TV3Authentication;
  /** The surveys the user may name in targeting (ENG-3282). */
  visibleSurveyWhere: Prisma.SurveyWhereInput;
  requestId: string;
}): Promise<{ before: TSurvey; after: TSurvey }> => {
  const { id: surveyId, workspaceId } = authorizedSurvey;
  const read = readFormbricksFileContent({ survey: body.survey, references: body.references });
  const { draft } = await prepareFormbricksFileDraft({
    read,
    workspaceId,
    organizationId,
    fieldPrefix: null,
    t: null,
  });
  // Keeping the survey's triggers keeps the file's out of the plan too: no action is created for them.
  const content = body.triggers === "keep" ? withoutDistribution(draft) : draft;
  const precondition = { expectedUpdatedAt: new Date(body.updatedAt) };
  // A trigger's action the workspace lacks is created under the importer's language, as on create.
  const t = await getImporterTranslate(getSessionUserId(authentication));

  return await runInSurveyWriteTransaction(async (transaction) => {
    const { tx } = transaction;
    const locked = await lockSurvey(tx, surveyId, workspaceId);
    if (!locked) throw new ResourceNotFoundError("Survey", surveyId);
    if (locked.archivedAt) throw new V3SurveyArchivedError();
    // Before the precondition: going live changes `updatedAt` too, and "Update anyway" would not help.
    if (locked.status === "inProgress") throw new SurveyImportUpdateActiveError();
    assertV3SurveyPrecondition(locked, precondition);

    const stored = await tx.survey.findUniqueOrThrow({
      where: { id: surveyId },
      select: selectSurveyWithCustomCss,
    });
    const before = transformPrismaSurvey<TSurvey>(stored);

    const plan = await planFormbricksFileReferences(tx, {
      workspaceId,
      survey: content,
      references: read.content.references,
      t,
      fieldPrefix: null,
    });
    const actionClassIds = await applyFormbricksFileReferences(tx, workspaceId, plan);
    const target = withTargetTriggers(content, actionClassIds);
    const embeddedFields = await linkSharedFields(tx, {
      workspaceId,
      draft: target,
      sharedFields: read.content.references.embeddedFields,
    });

    try {
      const after = await patchV3Survey(before, toUpdatePatch(target, before), {
        requestId,
        organizationId,
        precondition,
        visibleSurveyWhere,
        customCssPrincipal: getV3CustomCssPrincipal(authentication),
        transaction,
        embeddedFields,
      });
      return { before, after };
    } catch (error) {
      // The patch names fields from its own body, which is the reviewed survey: named from `survey`.
      if (error instanceof V3SurveyReferenceValidationError) {
        throw refuseDraft(nameFromSurvey(error.invalidParams, null));
      }
      throw error;
    }
  });
};

import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type {
  TResponseData,
  TResponseDataValue,
  TResponseMeta,
  TResponseTtc,
} from "@formbricks/types/responses";
import type { InvalidParam } from "@/app/api/v3/lib/response";
import { sendToPipeline } from "@/app/lib/pipelines";
import { inlineSurveyEmbeddedFields } from "@/lib/embedded-data/survey-fields";
import { applyAnonymizePolicy } from "@/lib/response/anonymize";
import { normalizeResponseLanguage } from "@/lib/response/utils";
import { evaluateResponseQuotas } from "@/modules/ee/quotas/lib/evaluation-service";
import { type TV3ResponseSurveyRow, v3ResponseReadSelect, v3ResponseSurveySelect } from "./service";

/**
 * The database half of the v3 response writes.
 *
 * Split from `service.ts` rather than appended to it because the two answer different questions: that
 * file is about reading a response without leaving its workspace, this one is about the ordering a
 * write has to respect. They share the selects and nothing else.
 *
 * Three orderings here are load-bearing and none of them is the obvious one:
 *
 * 1. **Reference checks run inside the transaction**, against the same snapshot the write uses. A
 *    `displayId` checked before the transaction can be claimed by a concurrent create in between.
 * 2. **Quota evaluation runs after the row exists**, in the same transaction, because a `reserved`
 *    quota operand resolves against the persisted row (ENG-1840) — and because it may itself flip
 *    `finished` to `true`.
 * 3. **Pipeline dispatch runs after commit**, and its `finished` comes from the row that was read
 *    back, never from the request body. A dispatch inside the transaction emits an event for a
 *    response a rollback then removes.
 */

/**
 * The survey a write is validated against: the read's select plus the three things only a write
 * needs. `endings` and `languages` back the two 422s that need no database of their own, and
 * `isAnonymizeResponsesEnabled` is what stops a caller writing submission context onto a survey
 * whose author turned anonymization on.
 */
export const v3WriteSurveySelect = {
  ...v3ResponseSurveySelect,
  questions: true,
  endings: true,
  isAnonymizeResponsesEnabled: true,
} satisfies Prisma.SurveySelect;

export type TV3WriteSurveyRow = Prisma.SurveyGetPayload<{ select: typeof v3WriteSurveySelect }> &
  Pick<TV3ResponseSurveyRow, "embeddedFields">;

/**
 * Resolve the survey a create is scoped by, **unscoped on purpose**.
 *
 * Same shape as `getResponseWorkspaceId`, and safe for the same reason: the caller feeds the
 * workspace straight into `requireV3WorkspaceAccess` and answers one 403 whether the survey is
 * missing or belongs to someone else. Resolving the scope from the survey rather than from a
 * client-supplied `workspaceId` is what makes it unforgeable.
 */
export async function getSurveyForV3Write(surveyId: string): Promise<TV3WriteSurveyRow | null> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: v3WriteSurveySelect,
  });

  return survey ? { ...survey, embeddedFields: inlineSurveyEmbeddedFields(survey) } : null;
}

/**
 * What a write reads back, and why it is not the read select.
 *
 * The row has two consumers with different needs: the serializer, which wants exactly what a `GET`
 * returns, and the pipeline payload, which is Zod-parsed against `ZResponse` in-request and fails on
 * a partial shape. Reading once with the union is a query cheaper than reading twice, and it is the
 * only way the two can never disagree about what was persisted.
 */
export const v3WriteReadbackSelect = {
  ...v3ResponseReadSelect,
  contactAttributes: true,
  tags: {
    select: {
      tag: { select: { id: true, createdAt: true, updatedAt: true, name: true, workspaceId: true } },
    },
  },
} satisfies Prisma.ResponseSelect;

export type TV3WriteReadbackRow = Prisma.ResponseGetPayload<{ select: typeof v3WriteReadbackSelect }>;

/** Read back a written response, scoped. `null` means it was removed between the write and the read. */
export async function readbackV3Response(
  responseId: string,
  { workspaceId }: { workspaceId: string }
): Promise<TV3WriteReadbackRow | null> {
  return prisma.response.findFirst({
    where: { id: responseId, survey: { workspaceId } },
    select: v3WriteReadbackSelect,
  });
}

/**
 * The reference checks that need the database, run against the transaction's own snapshot.
 *
 * Every one of these is a 422 rather than a 404: the body is well-formed and the conflict is with
 * stored state. They are also all scoped to the workspace the caller is already authorized for, so
 * none of them can report on a resource outside it — "not in this workspace" and "does not exist"
 * produce the same message deliberately, which is what keeps them from being existence oracles for
 * the tenant next door.
 */
async function collectReferenceIssues(
  tx: Prisma.TransactionClient,
  {
    workspaceId,
    surveyId,
    contactId,
    displayId,
    singleUseId,
    tagIds,
    excludeResponseId,
  }: {
    workspaceId: string;
    surveyId: string;
    contactId?: string;
    displayId?: string;
    singleUseId?: string;
    tagIds?: string[];
    excludeResponseId?: string;
  }
): Promise<{ issues: InvalidParam[]; contactAttributes: Prisma.JsonValue | undefined }> {
  const issues: InvalidParam[] = [];
  let contactAttributes: Prisma.JsonValue | undefined;

  if (contactId) {
    const contact = await tx.contact.findFirst({
      where: { id: contactId, workspaceId },
      select: { id: true, attributes: { select: { value: true, attributeKey: { select: { key: true } } } } },
    });

    if (contact) {
      // Snapshotted at create time, exactly as v1 and v2 do. v3 never publishes it, but the pipeline
      // reads `contactAttributes.userId` to identify the respondent to integrations, and an export
      // written months later cannot reconstruct what the attributes were on the day.
      contactAttributes = Object.fromEntries(
        contact.attributes.map(({ attributeKey, value }) => [attributeKey.key, value])
      );
    } else {
      issues.push({
        name: "contactId",
        reason: "No contact with this id exists in this workspace.",
        code: "invalid_reference",
      });
    }
  }

  if (displayId) {
    const display = await tx.display.findFirst({
      where: { id: displayId, surveyId },
      select: { id: true, response: { select: { id: true } } },
    });

    if (!display) {
      issues.push({
        name: "displayId",
        reason: "No display with this id exists for this survey.",
        code: "invalid_reference",
      });
    } else if (display.response && display.response.id !== excludeResponseId) {
      issues.push({
        name: "displayId",
        reason: "This display already backs another response.",
        code: "duplicate_identifier",
      });
    }
  }

  if (singleUseId) {
    const taken = await tx.response.findFirst({
      where: { singleUseId, surveyId, id: { not: excludeResponseId } },
      select: { id: true },
    });

    if (taken) {
      issues.push({
        name: "singleUseId",
        reason: "This single-use id has already been used for this survey.",
        code: "duplicate_identifier",
      });
    }
  }

  if (tagIds && tagIds.length > 0) {
    const found = await tx.tag.findMany({
      where: { id: { in: tagIds }, workspaceId },
      select: { id: true },
    });
    const foundIds = new Set(found.map((tag) => tag.id));

    for (const tagId of tagIds) {
      if (!foundIds.has(tagId)) {
        issues.push({
          name: "tags",
          reason: `No tag with id '${tagId}' exists in this workspace.`,
          code: "invalid_reference",
          identifier: tagId,
        });
      }
    }
  }

  return { issues, contactAttributes };
}

/**
 * A unique-constraint violation the pre-checks above lost a race to.
 *
 * Mapped to the same 422 the pre-check would have produced rather than to the generic 409, because
 * `POST`/`PATCH` do not document a 409 and a race must not be distinguishable from losing the check
 * outright. **The constraint name never reaches the body** — `Response_singleUseId_key` names an
 * internal index, and the field is named from `meta.target` instead.
 */
function raceIssuesFromUniqueViolation(error: unknown): InvalidParam[] | null {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return null;

  const target = error.meta?.target;
  const columns = Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];

  if (columns.some((column) => column.includes("singleUseId"))) {
    return [
      {
        name: "singleUseId",
        reason: "This single-use id has already been used for this survey.",
        code: "duplicate_identifier",
      },
    ];
  }

  if (columns.some((column) => column.includes("displayId"))) {
    return [
      {
        name: "displayId",
        reason: "This display already backs another response.",
        code: "duplicate_identifier",
      },
    ];
  }

  return null;
}

/** Either the row a write persisted, or the reference failures that stopped it. */
export type TV3WriteOutcome = { ok: true; responseId: string } | { ok: false; issues: InvalidParam[] };

export type TV3CreateResponsePersist = {
  workspaceId: string;
  survey: TV3WriteSurveyRow;
  finished: boolean;
  data: TResponseData;
  variables: Record<string, TResponseDataValue>;
  ttc: TResponseTtc;
  meta: TResponseMeta | undefined;
  tagIds: string[];
  endingId: string | null | undefined;
  language: string | null | undefined;
  contactId: string | undefined;
  displayId: string | undefined;
  singleUseId: string | undefined;
};

/**
 * Create one response, its tags and its quota links in a single transaction.
 *
 * The quota step can flip `finished` to `true` on the row it just counted, so nothing downstream may
 * assume the request body's `finished` is what got stored — the caller reads the row back.
 */
export async function createScopedResponse(input: TV3CreateResponsePersist): Promise<TV3WriteOutcome> {
  const { workspaceId, survey, meta, tagIds, contactId, displayId, singleUseId } = input;
  const language = normalizeResponseLanguage(input.language) ?? null;

  try {
    return await prisma.$transaction(async (tx) => {
      const { issues, contactAttributes } = await collectReferenceIssues(tx, {
        workspaceId,
        surveyId: survey.id,
        contactId,
        displayId,
        singleUseId,
        tagIds,
      });

      if (issues.length > 0) {
        return { ok: false as const, issues };
      }

      const created = await tx.response.create({
        data: {
          survey: { connect: { id: survey.id } },
          ...(displayId ? { display: { connect: { id: displayId } } } : {}),
          ...(contactId
            ? {
                contact: { connect: { id: contactId } },
                contactAttributes: contactAttributes ?? Prisma.JsonNull,
              }
            : {}),
          finished: input.finished,
          data: input.data,
          variables: input.variables,
          ttc: input.ttc,
          // "Anonymize responses" is a property of the survey, not of the door the response arrived
          // through, so it is applied here rather than trusted from the caller.
          meta: applyAnonymizePolicy(meta, survey.isAnonymizeResponsesEnabled) ?? {},
          language,
          endingId: input.endingId ?? null,
          singleUseId: singleUseId ?? null,
          ...(tagIds.length > 0
            ? { tags: { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) } }
            : {}),
        },
        select: { id: true, finished: true, data: true, variables: true },
      });

      await evaluateResponseQuotas({
        surveyId: survey.id,
        responseId: created.id,
        data: created.data as TResponseData,
        variables: created.variables as Record<string, TResponseDataValue>,
        language: language ?? "default",
        responseFinished: created.finished,
        // The row as persisted, so `reserved` quota operands resolve (ENG-1840).
        response: created as never,
        tx,
      });

      return { ok: true as const, responseId: created.id };
    });
  } catch (error) {
    const raceIssues = raceIssuesFromUniqueViolation(error);
    if (raceIssues) return { ok: false, issues: raceIssues };

    throw error;
  }
}

export type TV3UpdateResponsePersist = {
  responseId: string;
  workspaceId: string;
  survey: TV3WriteSurveyRow;
  /** Only the keys the payload actually carried — an absent one must not be written as `undefined`. */
  patch: {
    finished?: boolean;
    endingId?: string | null;
    language?: string | null;
    data?: TResponseData;
    variables?: Record<string, TResponseDataValue>;
    tagIds?: string[];
  };
};

/**
 * Apply a patch to one response, scoped, in a single transaction.
 *
 * `tags` is replace-the-set rather than add: the contract defines it as the complete set, so the
 * join rows are cleared and rewritten. Everything else is set only when the payload carried it —
 * spreading `undefined` into a Prisma `update` is the difference between "leave it" and "null it"
 * for the nullable columns, and `endingId` and `language` are both nullable.
 */
export async function updateScopedResponse({
  responseId,
  workspaceId,
  survey,
  patch,
}: TV3UpdateResponsePersist): Promise<TV3WriteOutcome> {
  try {
    return await prisma.$transaction(async (tx) => {
      const { issues } = await collectReferenceIssues(tx, {
        workspaceId,
        surveyId: survey.id,
        tagIds: patch.tagIds,
        excludeResponseId: responseId,
      });

      if (issues.length > 0) {
        return { ok: false as const, issues };
      }

      // Scoped `where`, never a bare id — a response outside the workspace matches nothing and
      // Prisma raises P2025, which the operation renders as the same 403 as a pre-flight rejection.
      const updated = await tx.response.update({
        where: { id: responseId, survey: { workspaceId } },
        data: {
          ...(patch.finished === undefined ? {} : { finished: patch.finished }),
          ...(patch.endingId === undefined ? {} : { endingId: patch.endingId }),
          ...(patch.language === undefined
            ? {}
            : { language: normalizeResponseLanguage(patch.language) ?? null }),
          ...(patch.data === undefined ? {} : { data: patch.data }),
          ...(patch.variables === undefined ? {} : { variables: patch.variables }),
          ...(patch.tagIds === undefined
            ? {}
            : {
                tags: {
                  deleteMany: {},
                  create: patch.tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })),
                },
              }),
        },
        select: { id: true, finished: true, data: true, variables: true, language: true },
      });

      // Evaluated on every patch, not only on one that finishes the response. For a quota with
      // `countPartialSubmissions: false` the link row is written only once the response is finished,
      // so a create-only evaluation silently under-counts every response that finishes later.
      await evaluateResponseQuotas({
        surveyId: survey.id,
        responseId: updated.id,
        data: updated.data as TResponseData,
        variables: updated.variables as Record<string, TResponseDataValue>,
        language: updated.language ?? "default",
        responseFinished: updated.finished,
        response: updated as never,
        tx,
      });

      return { ok: true as const, responseId: updated.id };
    });
  } catch (error) {
    const raceIssues = raceIssuesFromUniqueViolation(error);
    if (raceIssues) return { ok: false, issues: raceIssues };

    throw error;
  }
}

/**
 * Emit the pipeline events for a committed write — after commit, and never fatally.
 *
 * **A queueing failure does not fail the request.** The row is already committed, so a 500 here
 * would tell a caller its write failed when it did not, and the retry that follows creates a second
 * response. A missed webhook is recoverable; a duplicated submission is not. `sendToPipeline`
 * rethrows on failure, which is why this wrapper exists at all.
 *
 * `finished` comes from the row that was read back rather than from the request: quota evaluation
 * can finish a response the caller submitted as partial, and that response has genuinely finished.
 */
export async function dispatchV3ResponsePipeline({
  event,
  workspaceId,
  surveyId,
  response,
  alsoFinished,
}: {
  event: "responseCreated" | "responseUpdated";
  workspaceId: string;
  surveyId: string;
  response: unknown;
  alsoFinished: boolean;
}): Promise<void> {
  const events: ("responseCreated" | "responseUpdated" | "responseFinished")[] = alsoFinished
    ? [event, "responseFinished"]
    : [event];

  for (const pipelineEvent of events) {
    try {
      await sendToPipeline({
        event: pipelineEvent,
        workspaceId,
        surveyId,
        response: response as never,
      });
    } catch (error) {
      logger.error(
        { err: error, event: pipelineEvent, surveyId, workspaceId },
        "V3 response pipeline dispatch failed"
      );
    }
  }
}

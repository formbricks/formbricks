import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import type { TLinkedEmbeddedField } from "@formbricks/types/embedded-data-resolver";
import { ResourceNotFoundError, UniqueConstraintError } from "@formbricks/types/errors";
import { type TKeysetCursor, keysetOrderBy, keysetPagePredicate } from "@/app/api/v3/lib/keyset-cursor";
import { deleteDisplay } from "@/lib/display/service";
import { inlineSurveyEmbeddedFields, selectSurveyEmbeddedDataLinks } from "@/lib/embedded-data/survey-fields";
import { deleteResponseFileUrls } from "@/modules/storage/lib/delete-response-files";
import { collectResponseFileUrls, getSurveyFileUploadElementIds } from "@/modules/storage/utils";
import type { TV3ResponsesFilter } from "./parse-v3-responses-list-query";

/**
 * The one service the v3 response operations go through.
 *
 * It **composes** the existing quota, storage and display helpers and adds its own workspace-scoped
 * accessors. It deliberately does not touch `apps/web/lib/response/service.ts` or anything else v1
 * management and the dashboard already run: retrofitting the old paths would move this project's blast
 * radius onto surfaces nobody asked to change.
 *
 * The rule that shapes every function here: **the resolved workspace goes in the `where` clause.** No v3
 * path may reach the bare-id accessor at `lib/response/service.ts` (`getResponse`, a `findUnique` on
 * `id` alone), because a bare id is how a caller reads another tenant's response. `Response` carries no
 * `workspaceId` column, so tenancy is only expressible as `survey: { workspaceId }`.
 */

/**
 * Prisma codes are branched **here**, before anything wraps them.
 *
 * `DatabaseError` takes only a message, and the codebase convention is to rethrow
 * `new DatabaseError(error.message)` — which destroys the code. By the time a shared mapper sees it there
 * is nothing left to branch on, so it correctly answers a generic 500. Mapping at the throw site is the
 * only place the code still exists.
 *
 * `P2025` becomes `ResourceNotFoundError` so the shared mapper renders it as the *same* 403 body a
 * pre-flight ownership rejection produces — which is the whole point, since a scoped write that matches
 * nothing must not be distinguishable from one the caller may not touch.
 *
 * `P2003` (a dangling foreign key) is deliberately left alone: it is the caller's input and deserves a
 * 422 naming the field, which only an operation that knows the field can build. On Prisma 7 its
 * constraint name is nested under `meta.driverAdapterError.cause`, not where the docs put it.
 */
function rethrowScopedPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      // No id in the message: it would travel into a log line that is already correlated by requestId,
      // and the operations layer keeps it out of the body.
      throw new ResourceNotFoundError("Response", null);
    }

    if (error.code === "P2002") {
      throw new UniqueConstraintError("A response with these unique values already exists");
    }
  }

  throw error;
}

type TWorkspaceScope = { workspaceId: string };

/**
 * Resolve which workspace owns a response, without asserting the caller may see it.
 *
 * Deliberately unscoped, and safe because of what the caller does next: the operation feeds this into
 * `requireV3WorkspaceAccess` and answers an identical 403 whether the response is missing or forbidden.
 * Resolving the scope *from the response* rather than trusting a client-supplied `workspaceId` is what
 * makes the scope unforgeable — a caller cannot pair someone else's response id with a workspace they
 * happen to have access to. Same shape as `authorizeTagMutation`.
 */
export async function getResponseWorkspaceId(responseId: string): Promise<string | null> {
  try {
    const response = await prisma.response.findFirst({
      where: { id: responseId },
      select: { survey: { select: { workspaceId: true } } },
    });

    return response?.survey.workspaceId ?? null;
  } catch (error) {
    rethrowScopedPrismaError(error);
  }
}

/**
 * The deleted row as recorded in the audit trail: the response's own scalars, no relations. Mirrors v1's
 * `responseSelection` minus its `contact`/`tags` joins, which are not worth adding to a delete.
 */
const deletedResponseSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  finished: true,
  surveyId: true,
  contactId: true,
  endingId: true,
  data: true,
  variables: true,
  ttc: true,
  // Deliberately absent: `meta` and `contactAttributes`. Nothing reads either — they would reach only
  // the audit log's `oldObject`, and `redactPII` (`lib/utils/logger-helpers.ts`) matches exact key
  // names, so `meta.ipAddress` lands there in plaintext. Those two are precisely what this resource's
  // contract names as never exposed in any view, and writing them to a store with its own retention,
  // access model and export path is exposing them. `contactId` and `surveyId` keep the record
  // reviewable without either. ENG-2873 covers the general shape of this problem.
  singleUseId: true,
  language: true,
  displayId: true,
} satisfies Prisma.ResponseSelect;

export type TDeletedResponse = Prisma.ResponseGetPayload<{ select: typeof deletedResponseSelect }>;

/**
 * Delete one response inside its workspace, and clean up everything that goes with it.
 *
 * The order is load-bearing, because what needs cleaning up **vanishes with the row**: the file URLs
 * live only inside `response.data`. Written the obvious way — delete, then work out what to clean up —
 * they are already gone. So the delete's own `select` captures them, which is also how the legacy path
 * gets them.
 *
 * Returns the deleted row so the caller can record it as the audit event's `oldObject`. A delete that
 * leaves no trace of *what* it destroyed is not a reviewable audit trail, and v1, v2 and
 * `deleteV3FeedbackRecord` all record it. Field set matches v1's `responseSelection` scalars; the
 * `contact` and `tags` joins it also carries are left out rather than adding joins to a delete.
 *
 * **The delete's `select` must stay scalar-only.** On Prisma 7 a `delete` whose `select` pulls in a
 * relation is compiled as read-then-delete, and the client returns the *read* payload without checking
 * that the DELETE matched a row — so a concurrent caller that lost the race is told it succeeded
 * instead of raising `P2025`. Measured: with a relation in the select two racing deletes of the same
 * row both resolved, 3 times out of 3; with scalars only, exactly one raised `P2025` every time. That
 * is why the survey's element ids are fetched by their own query rather than joined in here.
 *
 * Storage deletion happens **after** the transaction commits. Inside it, a rollback would leave a live
 * response pointing at deleted objects; both existing delete paths order it this way for that reason.
 *
 * Fires nothing to webhooks: there is no `responseDeleted` trigger anywhere in the repo, and none of the
 * three existing delete implementations dispatches one. The Hub cascade is ENG-2855's, after the Hub
 * release; this just does not make it harder to add.
 */
export async function deleteScopedResponse(
  responseId: string,
  { workspaceId }: TWorkspaceScope
): Promise<TDeletedResponse> {
  let deleted: { row: TDeletedResponse; fileUrls: string[] };

  try {
    deleted = await prisma.$transaction(async (tx) => {
      // Scoped `where`, never a bare id. A response outside the workspace matches nothing and Prisma
      // raises P2025, which becomes the same 403 as a pre-flight rejection — so one scoped statement
      // does the ownership check and the delete together, with no window between them and no second
      // query whose absence a caller could time.
      const deletedRow = await tx.response.delete({
        where: { id: responseId, survey: { workspaceId } },
        // Scalars only, deliberately — see the note above the function. The survey's element ids are
        // read separately, below.
        select: deletedResponseSelect,
      });

      // The survey outlives the response, so this reads correctly after the delete. Both shapes:
      // `getSurveyFileUploadElementIds` documents the union as mandatory and v1/v2 pass both.
      const survey = await tx.survey.findUnique({
        where: { id: deletedRow.surveyId },
        select: { blocks: true, questions: true },
      });

      if (deletedRow.displayId) {
        await deleteDisplay(deletedRow.displayId, tx);
      }

      // Deliberately no `reduceQuotaLimits` here. `ON DELETE CASCADE` drops the `ResponseQuotaLink`
      // rows, and the only fullness predicate in the repo is `screenedInCount >= quota.limit`
      // (`modules/ee/quotas/lib/utils.ts`) counting those same live rows — so the cascade *already*
      // gives the capacity back. Decrementing `limit` on top of that cancels the slot the cascade freed
      // and permanently shrinks a customer-configured setting that nothing restores; repeated deletes
      // ratchet it down. `limit` is user-facing ("Limit" in the quota editor), and the dashboard's
      // checkbox — "Decrement all limits of quotas including this response" — is an explicit opt-in to
      // that separate intent, not delete housekeeping. So v3 takes v1's `decrementQuotas = false`
      // default. Exposing it as an opt-in flag later is additive; making it unconditional now would be
      // an irreversible default no caller can decline.

      // Read inside the transaction, deleted outside it.
      return {
        row: deletedRow,
        fileUrls: collectResponseFileUrls(
          deletedRow.data,
          getSurveyFileUploadElementIds({ blocks: survey?.blocks, questions: survey?.questions })
        ),
      };
    });
  } catch (error) {
    rethrowScopedPrismaError(error);
  }

  const { row, fileUrls } = deleted;

  // Skipped rather than called with an empty list: nothing to do, and it keeps the storage call out of
  // the common path. `workspaceId` is never `undefined` here — it came from the scope the caller was
  // already authorized against — which matters because a falsy second argument makes
  // `deleteResponseFileUrls` delete nothing and only emit a `logger.error`, failing silently.
  if (fileUrls.length > 0) {
    try {
      await deleteResponseFileUrls(fileUrls, workspaceId);
    } catch (error) {
      // The row is already gone and the caller's request succeeded; orphaned objects are a
      // storage-cleanup problem, not a reason to report a failed delete. Logged loudly so it is not
      // invisible.
      logger.error(
        { err: error, responseId, workspaceId, fileCount: fileUrls.length },
        "V3 response file cleanup failed"
      );
    }
  }

  return row;
}

export type TBatchDeleteResult = {
  /** Rows the database actually removed. Authoritative, and may be lower than the ids submitted. */
  deleted: number;
  /** The ids that were in scope when the batch was read, for the audit trail. */
  deletedIds: string[];
};

/**
 * Delete up to a batch of responses inside one workspace, in a single transaction.
 *
 * **It scope-filters instead of rejecting.** Every statement carries `survey: { workspaceId }`, so an
 * id belonging to another workspace, or one already deleted, simply matches nothing. That is the
 * contract's semantics and it is what makes the call idempotent: rejecting the batch on a foreign id
 * would both leak that the id exists somewhere and break retries, because after a partial application
 * an already-deleted id is indistinguishable from a foreign one.
 *
 * `deleteMany`'s own `count` is what gets reported, never the length of the earlier read. The two can
 * disagree — a concurrent caller may remove a row in between — and only the write knows what it
 * actually did. This is also why the batch needs no equivalent of the single delete's scalar-only
 * `select` rule: `deleteMany` returns a count rather than a row, so there is no relation join for
 * Prisma to compile into a read-then-delete.
 *
 * Responses are deleted before displays. Both orders are correct — `Response_displayId_fkey` is
 * `ON DELETE SET NULL`, so removing a display first nulls the referencing rows rather than failing —
 * but that null-out is a wasted write pass over rows about to be deleted anyway, and it touches the
 * unique index on `displayId`. This order also matches the single delete. Files are collected before
 * either and removed only after the transaction commits, for the same reason as the single delete.
 */
export async function deleteScopedResponses(
  responseIds: string[],
  { workspaceId }: TWorkspaceScope
): Promise<TBatchDeleteResult> {
  let outcome: TBatchDeleteResult & { fileUrls: string[] };

  try {
    outcome = await prisma.$transaction(async (tx) => {
      // Scoped read first: the file URLs live inside `response.data` and the display ids on the rows,
      // and both are gone once the rows are.
      const rows = await tx.response.findMany({
        where: { id: { in: responseIds }, survey: { workspaceId } },
        select: { id: true, displayId: true, data: true, surveyId: true },
      });

      if (rows.length === 0) {
        return { deleted: 0, deletedIds: [], fileUrls: [] };
      }

      // One read per distinct survey rather than per response: a batch may span several surveys in the
      // workspace, and at 100 ids the per-row form would be 100 queries for a handful of answers.
      const surveys = await tx.survey.findMany({
        where: { id: { in: [...new Set(rows.map((row) => row.surveyId))] } },
        select: { id: true, blocks: true, questions: true },
      });
      const uploadElementIds = new Map(
        surveys.map((survey) => [
          survey.id,
          getSurveyFileUploadElementIds({ blocks: survey.blocks, questions: survey.questions }),
        ])
      );

      const fileUrls = rows.flatMap((row) =>
        collectResponseFileUrls(row.data, uploadElementIds.get(row.surveyId) ?? new Set<string>())
      );

      // Responses before displays — see the note above. Not a correctness constraint: the FK is
      // SET NULL, so the reverse order also works, it just updates rows on their way out.
      const { count } = await tx.response.deleteMany({
        where: { id: { in: responseIds }, survey: { workspaceId } },
      });

      const displayIds = rows
        .map((row) => row.displayId)
        .filter((displayId): displayId is string => displayId !== null);

      if (displayIds.length > 0) {
        await tx.display.deleteMany({ where: { id: { in: displayIds } } });
      }

      return { deleted: count, deletedIds: rows.map((row) => row.id), fileUrls };
    });
  } catch (error) {
    rethrowScopedPrismaError(error);
  }

  const { fileUrls, ...result } = outcome;

  if (fileUrls.length > 0) {
    try {
      await deleteResponseFileUrls(fileUrls, workspaceId);
    } catch (error) {
      // The rows are already gone and the caller's request succeeded; orphaned objects are a
      // storage-cleanup problem, not a reason to report a failed delete. Same call as the single delete.
      logger.error(
        { err: error, workspaceId, responseCount: result.deleted, fileCount: fileUrls.length },
        "V3 batch response file cleanup failed"
      );
    }
  }

  return result;
}

/**
 * What a v3 read needs off a `Response` row.
 *
 * Narrower than v1's `responseSelection` in two ways that matter.
 *
 * `contactAttributes` is absent. The contract says the snapshot is never exposed in either view, and
 * nothing in the read path consumes it — `contact.userId` is the only identity the payload carries.
 *
 * The contact's attributes are **scoped to the one key** rather than pulled wholesale. v1 selects
 * every attribute for every response and then finds `userId` in JavaScript
 * (`lib/response/service.ts:69-76`, `:92-99`), which moves a workspace's entire contact PII through
 * the query for one string, on every row of every page.
 *
 * `meta` **is** selected here, unlike on the delete path: the reserved half of `embeddedData[]` reads
 * from it. It is an input to the projection, never echoed — the projection drops `ipAddress` and
 * everything the catalog marks `display: "none"`.
 */
export const v3ResponseReadSelect = {
  id: true,
  surveyId: true,
  createdAt: true,
  updatedAt: true,
  finished: true,
  endingId: true,
  language: true,
  data: true,
  variables: true,
  ttc: true,
  meta: true,
  displayId: true,
  singleUseId: true,
  contact: {
    select: {
      id: true,
      attributes: {
        where: { attributeKey: { key: "userId" } },
        select: { value: true },
      },
    },
  },
  tags: { select: { tag: { select: { id: true, name: true } } } },
} satisfies Prisma.ResponseSelect;

export type TV3ResponseRow = Prisma.ResponseGetPayload<{ select: typeof v3ResponseReadSelect }>;

/**
 * What a v3 read needs off the `Survey` the response belongs to.
 *
 * `blocks` carries the file-upload and element lookups. The legacy `questions` blob is deliberately
 * not selected: nothing on this path reads it, and hauling it across the wire for every survey on a
 * 250-row page costs real bytes. `languages`
 * carries what resolves the response's label language. `embeddedDataLinks` uses the shared constant
 * so the ordering rule stays decided in one place — see its own comment.
 */
export const v3ResponseSurveySelect = {
  id: true,
  name: true,
  workspaceId: true,
  updatedAt: true,
  blocks: true,
  languages: {
    select: { default: true, enabled: true, language: { select: { code: true } } },
  },
  embeddedDataLinks: selectSurveyEmbeddedDataLinks,
} satisfies Prisma.SurveySelect;

export type TV3ResponseSurveyRow = Prisma.SurveyGetPayload<{ select: typeof v3ResponseSurveySelect }> & {
  embeddedFields: TLinkedEmbeddedField[] | undefined;
};

/**
 * Load every survey a page of responses refers to, in one query.
 *
 * A page is up to 250 responses and may span every survey in the workspace, so this is the difference
 * between one query and 250. `getSurvey` is not an option even though it looks like one: it is
 * `reactCache`-wrapped, which dedupes the *same* id within a request and does nothing for distinct
 * ones, and it runs `selectSurvey` with five relations the serializer never reads.
 *
 * Returns a map so the caller indexes by `surveyId` without a second pass. Ids with no surviving
 * survey are simply absent — a response whose survey was deleted cannot be serialized against a
 * definition, and the caller decides what that means rather than this function inventing an answer.
 */
export async function getV3ResponseSurveys(
  surveyIds: readonly string[]
): Promise<Map<string, TV3ResponseSurveyRow>> {
  const unique = [...new Set(surveyIds)];
  if (unique.length === 0) {
    return new Map();
  }

  const surveys = await prisma.survey.findMany({
    where: { id: { in: unique } },
    select: v3ResponseSurveySelect,
  });

  return new Map(
    surveys.map((survey) => [survey.id, { ...survey, embeddedFields: inlineSurveyEmbeddedFields(survey) }])
  );
}

/**
 * The most rows a capped count will walk before answering "at least this many".
 *
 * Shared by the list's `meta.totalCount` and by `/count`, so the two can never disagree about where
 * exactness stops. At the cap the value is exactly this number and means "at least" — a scope with
 * precisely this many matches reports `gte`, which is the contract's reading.
 */
export const V3_RESPONSE_COUNT_CAP = 10_000;

/**
 * Identifiers, built from literals only.
 *
 * `Prisma.raw` interpolates without escaping, so these must never be derived from caller input. Every
 * caller-supplied value below is a bound parameter instead.
 *
 * Functions rather than module constants because the unit suite mocks `@formbricks/database/prisma`,
 * and a `Prisma.raw` call at module scope crashes at import time under that mock — taking the whole
 * file's tests with it. `keyset-cursor.ts` keeps its own `Prisma.raw` calls inside functions for the
 * same reason.
 */
const sortColumn = (): Prisma.Sql => Prisma.raw('r."created_at"');
const idColumn = (): Prisma.Sql => Prisma.raw('r."id"');

/**
 * The scope and the allow-listed filters, as SQL fragments.
 *
 * The workspace clause is present on **every** query and is never optional. `Response` has no
 * `workspaceId` column, so scope is only reachable through the survey — and a caller authorized for
 * one workspace can still name another workspace's `surveyId`, so filtering on `surveyId` alone
 * would serve that survey's responses. Pairing the two is what makes the scope real rather than
 * assumed, and it also means an out-of-scope `surveyId` yields an empty page rather than an error
 * that would confirm the survey exists.
 */
const scopeAndFilters = (filter: TV3ResponsesFilter): Prisma.Sql[] => {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`EXISTS (SELECT 1 FROM "Survey" s WHERE s."id" = r."surveyId" AND s."workspaceId" = ${filter.workspaceId})`,
  ];

  if (filter.surveyId) clauses.push(Prisma.sql`r."surveyId" = ${filter.surveyId}`);
  if (filter.contactId) clauses.push(Prisma.sql`r."contactId" = ${filter.contactId}`);
  if (filter.createdAtGte) clauses.push(Prisma.sql`r."created_at" >= ${filter.createdAtGte}`);
  if (filter.createdAtGt) clauses.push(Prisma.sql`r."created_at" > ${filter.createdAtGt}`);
  if (filter.createdAtLte) clauses.push(Prisma.sql`r."created_at" <= ${filter.createdAtLte}`);
  if (filter.createdAtLt) clauses.push(Prisma.sql`r."created_at" < ${filter.createdAtLt}`);
  if (filter.finished !== undefined) clauses.push(Prisma.sql`r."finished" = ${filter.finished}`);

  if (filter.languages?.length) {
    clauses.push(Prisma.sql`r."language" IN (${Prisma.join(filter.languages)})`);
  }

  if (filter.ids?.length) {
    clauses.push(Prisma.sql`r."id" IN (${Prisma.join(filter.ids)})`);
  }

  return clauses;
};

/** One ordered page of ids, straight off the keyset index. */
export interface TV3ResponseKeysetRow {
  id: string;
  createdAt: Date;
}

/**
 * Phase one of the list read: the ordered ids for a page.
 *
 * Raw SQL because the page condition has to be a row-constructor comparison — `(created_at, id) < (…)`
 * — which is the only form PostgreSQL puts inside the Index Cond, and which no Prisma `where` can
 * express. `keyset-cursor.ts` measured the alternatives: the `OR` expansion discards 4000 rows to
 * return 20, the row constructor discards none.
 *
 * It selects ids rather than rows because the payload needs `v3ResponseReadSelect`'s relations, and a
 * `select` and a `Prisma.Sql` cannot be combined in one query. Two queries against an indexed id set
 * is the cheaper half of that trade; the alternative is giving up the index.
 *
 * Fetches `limit + 1` so end-of-collection is decided by whether another row exists rather than by a
 * short page, which the contract makes the only valid signal.
 */
export async function listV3ResponseKeysetPage({
  filter,
  sortBy,
  limit,
  cursor,
}: {
  filter: TV3ResponsesFilter;
  sortBy: "-createdAt" | "createdAt";
  limit: number;
  cursor: Pick<TKeysetCursor, "value" | "id"> | null;
}): Promise<TV3ResponseKeysetRow[]> {
  const direction = sortBy === "-createdAt" ? "desc" : "asc";
  const clauses = scopeAndFilters(filter);

  if (cursor) {
    clauses.push(keysetPagePredicate({ sortColumn: sortColumn(), idColumn: idColumn(), direction, cursor }));
  }

  const rows = await prisma.$queryRaw<{ id: string; created_at: Date }[]>`
    SELECT r."id", r."created_at"
    FROM "Response" r
    WHERE ${Prisma.join(clauses, " AND ")}
    ${keysetOrderBy({ sortColumn: sortColumn(), idColumn: idColumn(), direction })}
    LIMIT ${limit + 1}
  `;

  return rows.map((row) => ({ id: row.id, createdAt: row.created_at }));
}

/**
 * Phase two: the full rows for an already-ordered, already-scoped set of ids.
 *
 * Re-ordered in memory to the ids' order, because `IN` does not preserve it and the page's order is
 * the whole point. No scope clause is repeated here: these ids came out of a scoped query, and
 * re-deriving the scope would be a second chance to get it wrong rather than a second guard.
 */
export async function hydrateV3Responses(ids: readonly string[]): Promise<TV3ResponseRow[]> {
  if (ids.length === 0) return [];

  const rows = await prisma.response.findMany({
    where: { id: { in: [...ids] } },
    select: v3ResponseReadSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));

  return ids.map((id) => byId.get(id)).filter((row): row is TV3ResponseRow => row !== undefined);
}

/**
 * How many responses match, and whether that number is exact.
 *
 * The capped path stops counting at {@link V3_RESPONSE_COUNT_CAP} rows, so an unbounded scope costs a
 * bounded amount of work. `exact` is the documented slow path a caller opts into, and it always
 * reports `eq`.
 */
export async function countV3Responses({
  filter,
  precision,
}: {
  filter: TV3ResponsesFilter;
  precision: "capped" | "exact";
}): Promise<{ count: number; relation: "eq" | "gte" }> {
  const where = Prisma.join(scopeAndFilters(filter), " AND ");

  if (precision === "exact") {
    const [row] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count FROM "Response" r WHERE ${where}
    `;

    return { count: Number(row?.count ?? 0), relation: "eq" };
  }

  // Counted over a bounded subquery rather than with a plain `count(*)`: the LIMIT lets PostgreSQL
  // stop walking the index once the cap is reached, which is the entire point of capping.
  const [row] = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::bigint AS count
    FROM (SELECT 1 FROM "Response" r WHERE ${where} LIMIT ${V3_RESPONSE_COUNT_CAP}) AS capped
  `;

  const count = Number(row?.count ?? 0);

  return { count, relation: count >= V3_RESPONSE_COUNT_CAP ? "gte" : "eq" };
}

/** One response, scoped. Returns `null` for both "does not exist" and "not in this workspace". */
export async function getScopedV3Response(
  responseId: string,
  { workspaceId }: { workspaceId: string }
): Promise<TV3ResponseRow | null> {
  return prisma.response.findFirst({
    where: { id: responseId, survey: { workspaceId } },
    select: v3ResponseReadSelect,
  });
}

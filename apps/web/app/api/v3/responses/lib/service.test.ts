import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { deleteScopedResponse, getResponseWorkspaceId } from "./service";

vi.mock("server-only", () => ({}));

const {
  mockTxDelete,
  mockTxSurvey,
  mockFindFirst,
  mockTransaction,
  mockDeleteDisplay,
  mockReduceQuotas,
  mockDeleteFiles,
} = vi.hoisted(() => ({
  mockTxDelete: vi.fn(),
  mockTxSurvey: vi.fn(),
  mockFindFirst: vi.fn(),
  mockTransaction: vi.fn(),
  mockDeleteDisplay: vi.fn(),
  mockReduceQuotas: vi.fn(),
  mockDeleteFiles: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    response: { findFirst: mockFindFirst },
    $transaction: mockTransaction,
  },
}));
vi.mock("@formbricks/database/prisma", () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code: string;
      constructor(message: string, code: string) {
        super(message);
        this.code = code;
      }
    },
  },
}));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/display/service", () => ({ deleteDisplay: mockDeleteDisplay }));
vi.mock("@/modules/ee/quotas/lib/quotas", () => ({ reduceQuotaLimits: mockReduceQuotas }));
vi.mock("@/modules/storage/lib/delete-response-files", () => ({ deleteResponseFileUrls: mockDeleteFiles }));
vi.mock("@/modules/storage/utils", () => ({
  collectResponseFileUrls: (data: unknown) => (data as { screenshots?: string[] })?.screenshots ?? [],
  getSurveyFileUploadElementIds: () => new Set(["screenshots"]),
}));

const RESPONSE_ID = "clrsaaaaaaaaaaaaaaaaaaaa";
const SCOPE = { workspaceId: "ws_1" };

/**
 * Runs the callback with a tx whose `response.delete` and `survey.findUnique` are our spies, like a
 * real interactive transaction. The survey is a separate query rather than a join precisely so the
 * delete keeps raising P2025 — see the service's own note.
 */
const runTransaction = (result: unknown, survey: unknown = { blocks: [], questions: [] }) => {
  mockTxDelete.mockResolvedValue(result);
  mockTxSurvey.mockResolvedValue(survey);
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ response: { delete: mockTxDelete }, survey: { findUnique: mockTxSurvey } })
  );
};

const deletedRow = (over: Record<string, unknown> = {}) => ({
  id: RESPONSE_ID,
  finished: true,
  surveyId: "svy_1",
  data: {},
  meta: {},
  displayId: null,
  ...over,
});

describe("deleteScopedResponse", () => {
  beforeEach(() => vi.clearAllMocks());

  /**
   * The security core of the service. `Response` has no `workspaceId` column, so tenancy is only
   * expressible as `survey: { workspaceId }` — and it has to be in the `where` of the delete itself, not
   * a check before it. A bare-id delete with a prior ownership read has a window between the two and
   * relies on nobody ever calling the accessor directly.
   */
  test("scopes the delete by workspace, never by bare id", async () => {
    runTransaction(deletedRow());

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    expect(mockTxDelete).toHaveBeenCalledTimes(1);
    const { where } = mockTxDelete.mock.calls[0][0];
    expect(where).toStrictEqual({ id: RESPONSE_ID, survey: { workspaceId: "ws_1" } });
  });

  /**
   * The file URLs live only inside `response.data`, so reading them after the delete returns nothing —
   * the delete's own select is the only place they can come from. The same select carries the scalars
   * the audit trail records, for the same reason: the row is gone afterwards.
   */
  test("captures the file data and the audit scalars in the delete's own select", async () => {
    runTransaction(deletedRow());

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    const { select } = mockTxDelete.mock.calls[0][0];
    expect(select.data).toBe(true);
    // What the audit event records. Losing any of these silently thins the trail.
    for (const field of ["id", "createdAt", "finished", "surveyId", "meta", "ttc", "variables", "language"]) {
      expect(select[field]).toBe(true);
    }
  });

  /**
   * Load-bearing, not stylistic. A `delete` whose select pulls a relation is compiled read-then-delete
   * on Prisma 7 and stops raising P2025 when the row is already gone, so a concurrent loser is told it
   * succeeded. The real-Postgres race in `service.integration.test.ts` measures that; this pins the
   * shape cheaply so the join cannot creep back in.
   */
  test("keeps the delete's select free of relations, and reads the survey separately", async () => {
    runTransaction(deletedRow());

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    const { select } = mockTxDelete.mock.calls[0][0];
    const relations = Object.entries(select).filter(([, v]) => typeof v === "object" && v !== null);
    expect(relations).toStrictEqual([]);

    // Both shapes, matching v1/v2 and the helper's documented union — not just `blocks`.
    expect(mockTxSurvey).toHaveBeenCalledWith({
      where: { id: "svy_1" },
      select: { blocks: true, questions: true },
    });
  });

  /**
   * Regression guard, and the reason it is phrased as a never-call.
   *
   * `ResponseQuotaLink` is `onDelete: Cascade` and the repo's only fullness predicate is
   * `screenedInCount >= quota.limit` over those live rows, so the cascade already returns the capacity.
   * `reduceQuotaLimits` decrements `SurveyQuota.limit` — the customer's configured target — which
   * cancels the freed slot and ratchets the limit down irreversibly. The dashboard exposes that as an
   * explicit opt-in checkbox; an API delete must not do it silently.
   *
   * Asserted against the mock rather than the DB because the earlier version of this test asserted only
   * that the mock *was* called, which cannot observe the direction of the effect. The real-Postgres
   * counterpart in `service.integration.test.ts` measures the quota state itself.
   */
  test("never shrinks the configured quota limit", async () => {
    runTransaction(deletedRow());

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    expect(mockReduceQuotas).not.toHaveBeenCalled();
  });

  /**
   * A delete that does not record what it destroyed is not a reviewable audit trail. The survey join is
   * a means to the file cleanup, not part of the row, so it must not ride along into the audit payload.
   */
  test("returns the deleted row for the audit trail, without the survey join", async () => {
    runTransaction(deletedRow({ data: { q1: "answer" }, singleUseId: "sui_1" }));

    const returned = await deleteScopedResponse(RESPONSE_ID, SCOPE);

    expect(returned).toStrictEqual({
      id: RESPONSE_ID,
      finished: true,
      surveyId: "svy_1",
      data: { q1: "answer" },
      meta: {},
      displayId: null,
      singleUseId: "sui_1",
    });
    expect(returned).not.toHaveProperty("survey");
  });

  test("deletes the linked display inside the same transaction", async () => {
    runTransaction(deletedRow({ displayId: "cldp_1" }));

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    expect(mockDeleteDisplay).toHaveBeenCalledWith("cldp_1", expect.anything());
  });

  /**
   * Ordering, asserted rather than assumed: inside the transaction a rollback would leave a live
   * response pointing at deleted objects. Both existing delete paths order it this way.
   */
  test("removes stored files only after the transaction commits", async () => {
    const order: string[] = [];
    mockTxDelete.mockResolvedValue(deletedRow({ data: { screenshots: ["https://s/a.png"] } }));
    mockTxSurvey.mockResolvedValue({ blocks: [], questions: [] });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const out = await fn({ response: { delete: mockTxDelete }, survey: { findUnique: mockTxSurvey } });
      order.push("commit");
      return out;
    });
    mockDeleteFiles.mockImplementation(async () => void order.push("files"));

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    expect(order).toStrictEqual(["commit", "files"]);
    expect(mockDeleteFiles).toHaveBeenCalledWith(["https://s/a.png"], "ws_1");
  });

  test("does not call storage at all when the response held no files", async () => {
    runTransaction(deletedRow());

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    // Passing a falsy workspace makes `deleteResponseFileUrls` delete nothing and only log, so calling
    // it with an empty list would look like success while doing nothing. Better not to call it.
    expect(mockDeleteFiles).not.toHaveBeenCalled();
  });

  /**
   * A failed file cleanup must not report a failed delete: the row is already gone and the caller's
   * request succeeded. Orphaned objects are a storage problem, logged loudly. The audit row still comes
   * back — the delete happened, so the trail must record it even though cleanup did not finish.
   */
  test("still succeeds when storage cleanup fails, and still returns the audit row", async () => {
    runTransaction(deletedRow({ data: { screenshots: ["https://s/a.png"] } }));
    mockDeleteFiles.mockRejectedValue(new Error("storage down"));

    await expect(deleteScopedResponse(RESPONSE_ID, SCOPE)).resolves.toMatchObject({ id: RESPONSE_ID });
  });

  /**
   * A scoped delete matching nothing raises P2025, and that has to become the error the shared mapper
   * renders as the *same* 403 a pre-flight rejection produces — otherwise a foreign id is
   * distinguishable from a nonexistent one.
   */
  test("turns a P2025 into ResourceNotFoundError, before anything can wrap it", async () => {
    const { Prisma } = await import("@formbricks/database/prisma");
    const KnownRequestError = Prisma.PrismaClientKnownRequestError as unknown as new (
      message: string,
      code: string
    ) => Error;
    mockTransaction.mockRejectedValue(new KnownRequestError("no rows", "P2025"));

    await expect(deleteScopedResponse(RESPONSE_ID, SCOPE)).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});

describe("getResponseWorkspaceId", () => {
  beforeEach(() => vi.clearAllMocks());

  test("resolves the owning workspace through the survey", async () => {
    mockFindFirst.mockResolvedValue({ survey: { workspaceId: "ws_9" } });

    await expect(getResponseWorkspaceId(RESPONSE_ID)).resolves.toBe("ws_9");
  });

  test("answers null for an unknown response, leaving the 403 to the caller", async () => {
    mockFindFirst.mockResolvedValue(null);

    await expect(getResponseWorkspaceId(RESPONSE_ID)).resolves.toBeNull();
  });
});

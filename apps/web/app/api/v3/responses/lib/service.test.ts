import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { deleteScopedResponse, deleteScopedResponses, getResponseWorkspaceId } from "./service";

vi.mock("server-only", () => ({}));

const {
  mockTxDelete,
  mockTxFindMany,
  mockTxDeleteMany,
  mockTxSurveyMany,
  mockTxDisplayDeleteMany,
  mockTxSurvey,
  mockFindFirst,
  mockTransaction,
  mockDeleteDisplay,
  mockReduceQuotas,
  mockDeleteFiles,
} = vi.hoisted(() => ({
  mockTxDelete: vi.fn(),
  mockTxFindMany: vi.fn(),
  mockTxDeleteMany: vi.fn(),
  mockTxSurveyMany: vi.fn(),
  mockTxDisplayDeleteMany: vi.fn(),
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

    // Not a correctness requirement — with a real workspace id an empty list is a harmless no-op — so
    // this pins the intent rather than a hazard: a response with no uploads must not reach storage at
    // all, which keeps the S3 client off the common path.
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

/**
 * The batch path's own unit tests. Its behaviour against real SQL — scope-filtering, the authoritative
 * count, the FK-safe ordering — is proven in `service.integration.test.ts`, which is the only place it
 * can be. These cover the parts that are ours rather than Postgres's: what goes into each statement,
 * how the survey reads are grouped, and what comes back.
 */
describe("deleteScopedResponses", () => {
  const BATCH_IDS = ["clrsaaaaaaaaaaaaaaaaaaaa", "clrsbbbbbbbbbbbbbbbbbbbb"];

  /** A tx exposing the four statements the batch issues. */
  const runBatch = (
    rows: Record<string, unknown>[],
    { count = rows.length, surveys = [{ id: "svy_1", blocks: [], questions: [] }] } = {}
  ) => {
    mockTxFindMany.mockResolvedValue(rows);
    mockTxDeleteMany.mockResolvedValue({ count });
    mockTxSurveyMany.mockResolvedValue(surveys);
    mockTxDisplayDeleteMany.mockResolvedValue({ count: 0 });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        response: { findMany: mockTxFindMany, deleteMany: mockTxDeleteMany },
        survey: { findMany: mockTxSurveyMany },
        display: { deleteMany: mockTxDisplayDeleteMany },
      })
    );
  };

  const row = (over: Record<string, unknown> = {}) => ({
    id: BATCH_IDS[0],
    displayId: null,
    data: {},
    surveyId: "svy_1",
    ...over,
  });

  beforeEach(() => vi.clearAllMocks());

  /**
   * The security core. Both statements must carry the scope: the read alone would let the delete take
   * ids the caller cannot see, and the delete alone would report a count for rows it never read.
   */
  test("scopes both the read and the delete by workspace", async () => {
    runBatch([row()]);

    await deleteScopedResponses(BATCH_IDS, SCOPE);

    expect(mockTxFindMany.mock.calls[0][0].where).toStrictEqual({
      id: { in: BATCH_IDS },
      survey: { workspaceId: "ws_1" },
    });
    expect(mockTxDeleteMany.mock.calls[0][0].where).toStrictEqual({
      id: { in: BATCH_IDS },
      survey: { workspaceId: "ws_1" },
    });
  });

  /**
   * `deleteMany` knows what it removed; the earlier read does not. A concurrent caller can take a row
   * in between, and reporting the read's length would then overstate the deletion.
   */
  test("reports the delete's own count, not the number of rows read", async () => {
    runBatch([row({ id: BATCH_IDS[0] }), row({ id: BATCH_IDS[1] })], { count: 1 });

    await expect(deleteScopedResponses(BATCH_IDS, SCOPE)).resolves.toMatchObject({ deleted: 1 });
  });

  test("short-circuits without deleting when nothing is in scope", async () => {
    runBatch([]);

    await expect(deleteScopedResponses(BATCH_IDS, SCOPE)).resolves.toStrictEqual({
      deleted: 0,
      deletedIds: [],
    });
    expect(mockTxDeleteMany).not.toHaveBeenCalled();
    expect(mockDeleteFiles).not.toHaveBeenCalled();
  });

  /**
   * One read per distinct survey, not per response. At the 100-id cap the per-row form would be 100
   * queries to collect a handful of file-upload element ids.
   */
  test("reads each distinct survey once, however many responses reference it", async () => {
    runBatch([row({ surveyId: "svy_1" }), row({ surveyId: "svy_1" }), row({ surveyId: "svy_2" })], {
      surveys: [
        { id: "svy_1", blocks: [], questions: [] },
        { id: "svy_2", blocks: [], questions: [] },
      ],
    });

    await deleteScopedResponses(BATCH_IDS, SCOPE);

    expect(mockTxSurveyMany).toHaveBeenCalledTimes(1);
    expect(mockTxSurveyMany.mock.calls[0][0].where).toStrictEqual({ id: { in: ["svy_1", "svy_2"] } });
  });

  test("removes the linked displays, and skips the statement when there are none", async () => {
    runBatch([row({ displayId: "cldp_1" }), row({ displayId: null })]);

    await deleteScopedResponses(BATCH_IDS, SCOPE);

    expect(mockTxDisplayDeleteMany).toHaveBeenCalledWith({ where: { id: { in: ["cldp_1"] } } });

    vi.clearAllMocks();
    runBatch([row({ displayId: null })]);
    await deleteScopedResponses(BATCH_IDS, SCOPE);
    expect(mockTxDisplayDeleteMany).not.toHaveBeenCalled();
  });

  test("collects file urls across the batch and deletes them after the transaction", async () => {
    const order: string[] = [];
    mockTxFindMany.mockResolvedValue([
      row({ data: { screenshots: ["https://s/a.png"] } }),
      row({ data: { screenshots: ["https://s/b.png"] } }),
    ]);
    mockTxDeleteMany.mockResolvedValue({ count: 2 });
    mockTxSurveyMany.mockResolvedValue([{ id: "svy_1", blocks: [], questions: [] }]);
    mockTxDisplayDeleteMany.mockResolvedValue({ count: 0 });
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const out = await fn({
        response: { findMany: mockTxFindMany, deleteMany: mockTxDeleteMany },
        survey: { findMany: mockTxSurveyMany },
        display: { deleteMany: mockTxDisplayDeleteMany },
      });
      order.push("commit");
      return out;
    });
    mockDeleteFiles.mockImplementation(async () => void order.push("files"));

    await deleteScopedResponses(BATCH_IDS, SCOPE);

    expect(order).toStrictEqual(["commit", "files"]);
    expect(mockDeleteFiles).toHaveBeenCalledWith(["https://s/a.png", "https://s/b.png"], "ws_1");
  });

  test("still succeeds when storage cleanup fails", async () => {
    runBatch([row({ data: { screenshots: ["https://s/a.png"] } })]);
    mockDeleteFiles.mockRejectedValue(new Error("storage down"));

    await expect(deleteScopedResponses(BATCH_IDS, SCOPE)).resolves.toMatchObject({ deleted: 1 });
  });

  /**
   * The catch must rethrow, not absorb. Swallowing here would surface as `deleted: 0` — a 200 telling
   * the caller nothing matched, when in fact the transaction failed and rows may still be there.
   */
  test("propagates a failed transaction instead of reporting nothing deleted", async () => {
    mockTransaction.mockRejectedValue(new Error("connection reset"));

    await expect(deleteScopedResponses(BATCH_IDS, SCOPE)).rejects.toThrow("connection reset");
  });

  /** Same decision as the single delete, and a batch would multiply the damage by up to 100. */
  test("never shrinks a configured quota limit", async () => {
    runBatch([row()]);

    await deleteScopedResponses(BATCH_IDS, SCOPE);

    expect(mockReduceQuotas).not.toHaveBeenCalled();
  });
});

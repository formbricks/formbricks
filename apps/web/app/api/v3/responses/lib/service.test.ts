import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { deleteScopedResponse, getResponseWorkspaceId } from "./service";

vi.mock("server-only", () => ({}));

const { mockTxDelete, mockFindFirst, mockTransaction, mockDeleteDisplay, mockReduceQuotas, mockDeleteFiles } =
  vi.hoisted(() => ({
    mockTxDelete: vi.fn(),
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

/** Runs the callback with a tx whose `response.delete` is our spy, like a real interactive transaction. */
const runTransaction = (result: unknown) => {
  mockTxDelete.mockResolvedValue(result);
  mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn({ response: { delete: mockTxDelete } })
  );
};

const deletedRow = (over: Record<string, unknown> = {}) => ({
  displayId: null,
  data: {},
  survey: { blocks: [] },
  quotaLinks: [],
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
   * Both of these vanish with the row — the file URLs live only inside `response.data`, and `quotaLinks`
   * go with ON DELETE CASCADE. Reading them after the delete returns nothing, so the delete's own select
   * is the only place they can come from.
   */
  test("captures the file data and quota links in the delete's own select", async () => {
    runTransaction(deletedRow());

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    const { select } = mockTxDelete.mock.calls[0][0];
    expect(select.data).toBe(true);
    expect(select.quotaLinks).toBeDefined();
    // Only the links that actually counted: a screened-out response never consumed quota capacity.
    expect(select.quotaLinks.where).toStrictEqual({ status: "screenedIn" });
  });

  /**
   * The cascade removes the links, which fixes the count. It does not touch `SurveyQuota.limit`, so
   * without this a deleted response keeps consuming capacity forever. Both management APIs miss it
   * today; only the dashboard opts in.
   */
  test("gives back the quota capacity the response consumed", async () => {
    runTransaction(deletedRow({ quotaLinks: [{ quota: { id: "q_1" } }, { quota: { id: "q_2" } }] }));

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    expect(mockReduceQuotas).toHaveBeenCalledWith(["q_1", "q_2"], expect.anything());
  });

  test("skips the quota write when the response counted against nothing", async () => {
    runTransaction(deletedRow());

    await deleteScopedResponse(RESPONSE_ID, SCOPE);

    expect(mockReduceQuotas).not.toHaveBeenCalled();
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
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const out = await fn({ response: { delete: mockTxDelete } });
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
   * request succeeded. Orphaned objects are a storage problem, logged loudly.
   */
  test("still succeeds when storage cleanup fails", async () => {
    runTransaction(deletedRow({ data: { screenshots: ["https://s/a.png"] } }));
    mockDeleteFiles.mockRejectedValue(new Error("storage down"));

    await expect(deleteScopedResponse(RESPONSE_ID, SCOPE)).resolves.toBeUndefined();
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

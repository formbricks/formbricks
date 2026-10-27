import { beforeEach, describe, expect, test, vi } from "vitest";
import { deleteFeedbackRecord, listFeedbackRecords } from "@/modules/hub/service";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { NO_CONFIG_ERROR } from "@/modules/hub/utils";
import { HUB_CLEANUP_PAGE_SIZE } from "./constants";
import { deleteHubRecords, isHubCallBudgetSpent } from "./hub-cleanup";

vi.mock("server-only", () => ({}));

vi.mock("@/modules/hub/service", () => ({
  deleteFeedbackRecord: vi.fn(),
  listFeedbackRecords: vi.fn(),
}));

const surveyId = "clsurvey00000000000000001";
const record = (id: string, overrides: Partial<FeedbackRecordData> = {}): FeedbackRecordData =>
  ({
    id,
    tenant_id: "dir-a",
    source_type: "formbricks_survey",
    source_id: surveyId,
    submission_id: "resp-1",
    ...overrides,
  }) as FeedbackRecordData;

const page = (records: FeedbackRecordData[]) => ({ data: { data: records }, error: null }) as never;
const budget = (remaining = 10_000) => ({ remaining, deadline: Date.now() + 60_000 });

describe("deleteHubRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteFeedbackRecord).mockResolvedValue({ data: { deleted: true }, error: null });
  });

  test("lists by tenant, source type and survey, deletes the page, and re-lists until empty", async () => {
    vi.mocked(listFeedbackRecords)
      .mockResolvedValueOnce(page([record("r1"), record("r2")]))
      .mockResolvedValueOnce(page([]));

    await expect(deleteHubRecords({ tenantIds: ["dir-a"], surveyId }, budget())).resolves.toEqual({
      status: "deleted",
      count: 2,
    });
    expect(listFeedbackRecords).toHaveBeenNthCalledWith(1, {
      tenant_id: "dir-a",
      source_type: ["formbricks_survey"],
      source_id: [surveyId],
      limit: HUB_CLEANUP_PAGE_SIZE,
    });
    // Always the first page: deleting moves the pages, so a cursor would skip records.
    expect(vi.mocked(listFeedbackRecords).mock.calls[1][0]).not.toHaveProperty("cursor");
    expect(deleteFeedbackRecord).toHaveBeenCalledWith("r1");
    expect(deleteFeedbackRecord).toHaveBeenCalledWith("r2");
  });

  test("is clean when no tenant holds a record, and narrows to the given responses", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue(page([]));

    await expect(
      deleteHubRecords({ tenantIds: ["dir-a", "dir-b"], surveyId, responseIds: ["resp-1"] }, budget())
    ).resolves.toEqual({ status: "clean" });
    expect(listFeedbackRecords).toHaveBeenCalledTimes(2);
    expect(listFeedbackRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ tenant_id: "dir-b", submission_id: ["resp-1"] })
    );
  });

  // The Hub deletes by bare id with no tenant check, so a listing that ignored a filter must never
  // turn into deletes.
  test.each([
    ["another tenant", { tenant_id: "dir-other" }],
    ["another source type", { source_type: "csv" }],
    ["another survey", { source_id: "clsurvey00000000000000002" }],
    ["another response", { submission_id: "resp-2" }],
  ])("deletes nothing when the listing returns a record of %s", async (_label, overrides) => {
    vi.mocked(listFeedbackRecords).mockResolvedValue(page([record("r1"), record("r2", overrides)]));

    await expect(
      deleteHubRecords({ tenantIds: ["dir-a"], surveyId, responseIds: ["resp-1"] }, budget())
    ).resolves.toEqual({ status: "failed", error: "hubFilterMismatch" });
    expect(deleteFeedbackRecord).not.toHaveBeenCalled();
  });

  test("treats a 404 on delete as already gone", async () => {
    vi.mocked(listFeedbackRecords)
      .mockResolvedValueOnce(page([record("r1")]))
      .mockResolvedValueOnce(page([]));
    vi.mocked(deleteFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "" },
    });

    await expect(deleteHubRecords({ tenantIds: ["dir-a"], surveyId }, budget())).resolves.toEqual({
      status: "deleted",
      count: 1,
    });
  });

  test("leaves a page of already-gone records to the next pass instead of re-listing it", async () => {
    // A listing lagging behind the deletes would otherwise return the same page until the budget is gone.
    vi.mocked(listFeedbackRecords).mockResolvedValue(page([record("r1"), record("r2")]));
    vi.mocked(deleteFeedbackRecord).mockResolvedValue({
      data: null,
      error: { status: 404, message: "not found", detail: "" },
    });

    await expect(deleteHubRecords({ tenantIds: ["dir-a"], surveyId }, budget())).resolves.toEqual({
      status: "deleted",
      count: 2,
    });
    expect(listFeedbackRecords).toHaveBeenCalledTimes(1);
  });

  test("stops before the next page once the run's deadline has passed", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue(page([record("r1")]));

    await expect(
      deleteHubRecords({ tenantIds: ["dir-a"], surveyId }, { remaining: 10_000, deadline: Date.now() - 1 })
    ).resolves.toEqual({ status: "budget", count: 0 });
    expect(listFeedbackRecords).not.toHaveBeenCalled();
  });

  test("fails on any other delete error, and on a listing error", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue(page([record("r1"), record("r2")]));
    vi.mocked(deleteFeedbackRecord)
      .mockResolvedValueOnce({ data: { deleted: true }, error: null })
      .mockResolvedValueOnce({ data: null, error: { status: 503, message: "down", detail: "" } });

    await expect(deleteHubRecords({ tenantIds: ["dir-a"], surveyId }, budget())).resolves.toEqual({
      status: "failed",
      error: "hubDelete:503",
    });

    vi.mocked(listFeedbackRecords).mockResolvedValue({
      data: null,
      error: { status: 500, message: "boom", detail: "" },
    } as never);
    await expect(deleteHubRecords({ tenantIds: ["dir-a"], surveyId }, budget())).resolves.toEqual({
      status: "failed",
      error: "hubList:500",
    });
  });

  test("names an unconfigured Hub, so the row waits rather than reading as an outage", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue({ data: null, error: { ...NO_CONFIG_ERROR } } as never);

    await expect(deleteHubRecords({ tenantIds: ["dir-a"], surveyId }, budget())).resolves.toEqual({
      status: "failed",
      error: "hubNotConfigured",
    });
  });

  test("stops before a page it can't finish, and spends a call per listing and delete", async () => {
    vi.mocked(listFeedbackRecords).mockResolvedValue(page([record("r1"), record("r2")]));
    // Enough for one full page and two more calls: the first page costs a listing and two deletes, and
    // what's left can't cover another full page.
    const callBudget = budget(1 + HUB_CLEANUP_PAGE_SIZE + 2);

    const result = await deleteHubRecords({ tenantIds: ["dir-a"], surveyId }, callBudget);

    expect(result).toEqual({ status: "budget", count: 2 });
    expect(listFeedbackRecords).toHaveBeenCalledTimes(1);
    expect(callBudget.remaining).toBe(HUB_CLEANUP_PAGE_SIZE);
    expect(isHubCallBudgetSpent(callBudget)).toBe(true);
  });
});

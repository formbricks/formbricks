import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockListFeedbackRecords = vi.fn();
const mockGetFeedbackRecordDirectoriesByWorkspaceId = vi.fn();

vi.mock("@/modules/hub/service", () => ({
  listFeedbackRecords: (...args: any[]) => mockListFeedbackRecords(...args),
}));

vi.mock("@/modules/ee/feedback-record-directory/lib/feedback-record-directory", () => ({
  getFeedbackRecordDirectoriesByWorkspaceId: (...args: any[]) =>
    mockGetFeedbackRecordDirectoriesByWorkspaceId(...args),
}));

const mockWorkspaceId = "workspace-abc-123";
const mockDirectoryId1 = "frd-1";
const mockDirectoryId2 = "frd-2";

const recordsResult = (count: number) => ({
  data: { data: Array.from({ length: count }, (_, i) => ({ id: `rec-${i}` })) },
  error: null,
});

const errorResult = () => ({
  data: null,
  error: { status: 500, message: "Hub error", detail: null },
});

const nullDataResult = () => ({
  data: null,
  error: null,
});

describe("hasFeedbackRecordsInDirectories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns false for empty directory list without calling the hub", async () => {
    const { hasFeedbackRecordsInDirectories } = await import("./feedback-records");

    const result = await hasFeedbackRecordsInDirectories([]);

    expect(result).toBe(false);
    expect(mockListFeedbackRecords).not.toHaveBeenCalled();
  });

  test("returns true when any directory has at least one record", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(recordsResult(0)).mockResolvedValueOnce(recordsResult(1));
    const { hasFeedbackRecordsInDirectories } = await import("./feedback-records");

    const result = await hasFeedbackRecordsInDirectories([mockDirectoryId1, mockDirectoryId2]);

    expect(result).toBe(true);
    expect(mockListFeedbackRecords).toHaveBeenCalledTimes(2);
    expect(mockListFeedbackRecords).toHaveBeenCalledWith({ tenant_id: mockDirectoryId1, limit: 1 });
    expect(mockListFeedbackRecords).toHaveBeenCalledWith({ tenant_id: mockDirectoryId2, limit: 1 });
  });

  test("returns false when all directories are empty and no errors occur", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(recordsResult(0)).mockResolvedValueOnce(recordsResult(0));
    const { hasFeedbackRecordsInDirectories } = await import("./feedback-records");

    const result = await hasFeedbackRecordsInDirectories([mockDirectoryId1, mockDirectoryId2]);

    expect(result).toBe(false);
  });

  test("returns true when all directories error (unknown availability does not lock flows)", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(errorResult()).mockResolvedValueOnce(errorResult());
    const { hasFeedbackRecordsInDirectories } = await import("./feedback-records");

    const result = await hasFeedbackRecordsInDirectories([mockDirectoryId1, mockDirectoryId2]);

    expect(result).toBe(true);
  });

  test("returns true when one directory errors and the rest are empty", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(recordsResult(0)).mockResolvedValueOnce(errorResult());
    const { hasFeedbackRecordsInDirectories } = await import("./feedback-records");

    const result = await hasFeedbackRecordsInDirectories([mockDirectoryId1, mockDirectoryId2]);

    expect(result).toBe(true);
  });

  test("returns true when records exist even if another directory errored", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(errorResult()).mockResolvedValueOnce(recordsResult(2));
    const { hasFeedbackRecordsInDirectories } = await import("./feedback-records");

    const result = await hasFeedbackRecordsInDirectories([mockDirectoryId1, mockDirectoryId2]);

    expect(result).toBe(true);
  });

  test("treats null data with no error as zero records", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(nullDataResult());
    const { hasFeedbackRecordsInDirectories } = await import("./feedback-records");

    const result = await hasFeedbackRecordsInDirectories([mockDirectoryId1]);

    expect(result).toBe(false);
  });

  test("returns true for a single directory with records", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(recordsResult(5));
    const { hasFeedbackRecordsInDirectories } = await import("./feedback-records");

    const result = await hasFeedbackRecordsInDirectories([mockDirectoryId1]);

    expect(result).toBe(true);
  });

  test("queries hub with tenant_id and limit 1 for each directory", async () => {
    mockListFeedbackRecords.mockResolvedValue(recordsResult(0));
    const { hasFeedbackRecordsInDirectories } = await import("./feedback-records");

    await hasFeedbackRecordsInDirectories([mockDirectoryId1, mockDirectoryId2]);

    expect(mockListFeedbackRecords).toHaveBeenCalledTimes(2);
    expect(mockListFeedbackRecords).toHaveBeenNthCalledWith(1, { tenant_id: mockDirectoryId1, limit: 1 });
    expect(mockListFeedbackRecords).toHaveBeenNthCalledWith(2, { tenant_id: mockDirectoryId2, limit: 1 });
  });
});

describe("hasWorkspaceFeedbackRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns false when the workspace has no directories", async () => {
    mockGetFeedbackRecordDirectoriesByWorkspaceId.mockResolvedValueOnce([]);
    const { hasWorkspaceFeedbackRecords } = await import("./feedback-records");

    const result = await hasWorkspaceFeedbackRecords(mockWorkspaceId);

    expect(result).toBe(false);
    expect(mockGetFeedbackRecordDirectoriesByWorkspaceId).toHaveBeenCalledWith(mockWorkspaceId);
    expect(mockListFeedbackRecords).not.toHaveBeenCalled();
  });

  test("returns true when at least one workspace directory has records", async () => {
    mockGetFeedbackRecordDirectoriesByWorkspaceId.mockResolvedValueOnce([
      { id: mockDirectoryId1, name: "Dir 1" },
      { id: mockDirectoryId2, name: "Dir 2" },
    ]);
    mockListFeedbackRecords.mockResolvedValueOnce(recordsResult(0)).mockResolvedValueOnce(recordsResult(3));
    const { hasWorkspaceFeedbackRecords } = await import("./feedback-records");

    const result = await hasWorkspaceFeedbackRecords(mockWorkspaceId);

    expect(result).toBe(true);
  });

  test("returns false when all workspace directories are empty", async () => {
    mockGetFeedbackRecordDirectoriesByWorkspaceId.mockResolvedValueOnce([
      { id: mockDirectoryId1, name: "Dir 1" },
    ]);
    mockListFeedbackRecords.mockResolvedValueOnce(recordsResult(0));
    const { hasWorkspaceFeedbackRecords } = await import("./feedback-records");

    const result = await hasWorkspaceFeedbackRecords(mockWorkspaceId);

    expect(result).toBe(false);
  });

  test("propagates the hub-error fallback (returns true) for known directories", async () => {
    mockGetFeedbackRecordDirectoriesByWorkspaceId.mockResolvedValueOnce([
      { id: mockDirectoryId1, name: "Dir 1" },
    ]);
    mockListFeedbackRecords.mockResolvedValueOnce(errorResult());
    const { hasWorkspaceFeedbackRecords } = await import("./feedback-records");

    const result = await hasWorkspaceFeedbackRecords(mockWorkspaceId);

    expect(result).toBe(true);
  });
});

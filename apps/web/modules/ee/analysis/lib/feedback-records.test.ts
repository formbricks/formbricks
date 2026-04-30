import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockListFeedbackRecords = vi.fn();

vi.mock("@/modules/hub/service", () => ({
  listFeedbackRecords: (...args: any[]) => mockListFeedbackRecords(...args),
}));

const mockWorkspaceId = "workspace-abc-123";

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

describe("hasWorkspaceFeedbackRecords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns true when workspace has at least one record", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(recordsResult(3));
    const { hasWorkspaceFeedbackRecords } = await import("./feedback-records");

    const result = await hasWorkspaceFeedbackRecords(mockWorkspaceId);

    expect(result).toBe(true);
    expect(mockListFeedbackRecords).toHaveBeenCalledWith({ tenant_id: mockWorkspaceId, limit: 1 });
  });

  test("returns false when workspace has no records", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(recordsResult(0));
    const { hasWorkspaceFeedbackRecords } = await import("./feedback-records");

    const result = await hasWorkspaceFeedbackRecords(mockWorkspaceId);

    expect(result).toBe(false);
    expect(mockListFeedbackRecords).toHaveBeenCalledWith({ tenant_id: mockWorkspaceId, limit: 1 });
  });

  test("returns false when data is null with no error", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(nullDataResult());
    const { hasWorkspaceFeedbackRecords } = await import("./feedback-records");

    const result = await hasWorkspaceFeedbackRecords(mockWorkspaceId);

    expect(result).toBe(false);
  });

  test("returns true when Hub returns an error (unknown availability does not lock flows)", async () => {
    mockListFeedbackRecords.mockResolvedValueOnce(errorResult());
    const { hasWorkspaceFeedbackRecords } = await import("./feedback-records");

    const result = await hasWorkspaceFeedbackRecords(mockWorkspaceId);

    expect(result).toBe(true);
  });
});

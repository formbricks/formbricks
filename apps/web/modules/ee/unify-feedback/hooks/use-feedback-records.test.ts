/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { FeedbackRecordData } from "@/modules/hub/types";
import { countDirectoryRecords, listDirectoryRecords } from "../lib/records-client";
import type { THubRecordQuery } from "../lib/table-filters";
import { useFeedbackRecords } from "./use-feedback-records";

vi.mock("../lib/records-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/records-client")>();
  return { ...actual, listDirectoryRecords: vi.fn(), countDirectoryRecords: vi.fn() };
});

const record = (id: string, collectedAt: string) =>
  ({ id, collected_at: collectedAt, created_at: collectedAt }) as unknown as FeedbackRecordData;

const renderRecords = (props: {
  directoryIds: readonly string[];
  query: THubRecordQuery | null;
  workspaceId?: string;
}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client }, children);
  return renderHook(() => useFeedbackRecords({ workspaceId: "ws_1", ...props }), { wrapper });
};

const query: THubRecordQuery = { sort: "collected_at", order: "desc" };

describe("useFeedbackRecords", () => {
  beforeEach(() => {
    vi.mocked(listDirectoryRecords).mockReset();
    vi.mocked(countDirectoryRecords).mockReset();
  });

  test("merges every directory's page in sort order and sums the counts", async () => {
    vi.mocked(listDirectoryRecords).mockImplementation(async ({ tenantId }) =>
      tenantId === "dir_a"
        ? { records: [record("a1", "2026-01-03"), record("a2", "2026-01-01")], nextCursor: null }
        : { records: [record("b1", "2026-01-02")], nextCursor: null }
    );
    vi.mocked(countDirectoryRecords).mockImplementation(async ({ tenantId }) =>
      tenantId === "dir_a" ? 12 : 30
    );

    const { result } = renderRecords({ directoryIds: ["dir_a", "dir_b"], query });

    await waitFor(() => expect(result.current.records).toHaveLength(3));
    expect(result.current.records.map((r) => r.id)).toEqual(["a1", "b1", "a2"]);
    await waitFor(() => expect(result.current.matchCount).toBe(42));
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.isError).toBe(false);
    expect(listDirectoryRecords).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: "dir_a", query, cursor: undefined })
    );
  });

  test("loads the next page only from directories that still have a cursor", async () => {
    vi.mocked(countDirectoryRecords).mockResolvedValue(1);
    vi.mocked(listDirectoryRecords).mockImplementation(async ({ tenantId, cursor }) => {
      if (cursor === "a_next") return { records: [record("a2", "2026-01-01")], nextCursor: null };
      return tenantId === "dir_a"
        ? { records: [record("a1", "2026-01-05")], nextCursor: "a_next" }
        : { records: [record("b1", "2026-01-04")], nextCursor: null };
    });

    const { result } = renderRecords({ directoryIds: ["dir_a", "dir_b"], query });

    await waitFor(() => expect(result.current.hasNextPage).toBe(true));

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.records.map((r) => r.id)).toEqual(["a1", "b1", "a2"]));
    expect(result.current.hasNextPage).toBe(false);
    expect(listDirectoryRecords).toHaveBeenCalledTimes(3);
    expect(listDirectoryRecords).toHaveBeenLastCalledWith(
      expect.objectContaining({ tenantId: "dir_a", cursor: "a_next" })
    );
  });

  test("a null query requests nothing and reports zero matches", async () => {
    const { result } = renderRecords({ directoryIds: ["dir_a"], query: null });

    expect(result.current.matchCount).toBe(0);
    expect(result.current.records).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
    expect(listDirectoryRecords).not.toHaveBeenCalled();
    expect(countDirectoryRecords).not.toHaveBeenCalled();
  });

  test("no directories requests nothing", async () => {
    const { result } = renderRecords({ directoryIds: [], query });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.records).toEqual([]);
    expect(listDirectoryRecords).not.toHaveBeenCalled();
  });

  test("surfaces a list failure as an error", async () => {
    vi.mocked(listDirectoryRecords).mockRejectedValue(new Error("hub down"));
    vi.mocked(countDirectoryRecords).mockResolvedValue(0);

    const { result } = renderRecords({ directoryIds: ["dir_a"], query });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error("hub down"));
  });

  test("refetch resolves when both requests succeed", async () => {
    vi.mocked(listDirectoryRecords).mockResolvedValue({ records: [], nextCursor: null });
    vi.mocked(countDirectoryRecords).mockResolvedValue(0);

    const { result } = renderRecords({ directoryIds: ["dir_a"], query });
    await waitFor(() => expect(result.current.matchCount).toBe(0));

    await expect(result.current.refetch()).resolves.toBeUndefined();
  });

  test("refetch rejects when the list refetch fails", async () => {
    vi.mocked(listDirectoryRecords).mockResolvedValueOnce({ records: [], nextCursor: null });
    vi.mocked(countDirectoryRecords).mockResolvedValue(0);

    const { result } = renderRecords({ directoryIds: ["dir_a"], query });
    await waitFor(() => expect(result.current.matchCount).toBe(0));

    vi.mocked(listDirectoryRecords).mockRejectedValue(new Error("list failed"));

    await act(async () => {
      await expect(result.current.refetch()).rejects.toThrow("list failed");
    });
  });

  test("refetch rejects when the count refetch fails", async () => {
    vi.mocked(listDirectoryRecords).mockResolvedValue({ records: [], nextCursor: null });
    vi.mocked(countDirectoryRecords).mockResolvedValueOnce(5);

    const { result } = renderRecords({ directoryIds: ["dir_a"], query });
    await waitFor(() => expect(result.current.matchCount).toBe(5));

    vi.mocked(countDirectoryRecords).mockRejectedValue(new Error("count failed"));

    await act(async () => {
      await expect(result.current.refetch()).rejects.toThrow("count failed");
    });
  });

  test("refetch does nothing when the query is disabled, instead of failing", async () => {
    const { result } = renderRecords({ directoryIds: ["dir_a"], query: null });

    await act(async () => {
      await expect(result.current.refetch()).resolves.toBeUndefined();
    });
    expect(listDirectoryRecords).not.toHaveBeenCalled();
    expect(countDirectoryRecords).not.toHaveBeenCalled();
  });
});

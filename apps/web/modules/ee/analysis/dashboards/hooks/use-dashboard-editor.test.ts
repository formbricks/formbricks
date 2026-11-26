/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { usePathname, useSearchParams } from "next/navigation";
import { type ReactNode, createElement } from "react";
import toast from "react-hot-toast";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  type TAppDashboard,
  getDashboard,
  isStaleDashboardError,
  replaceDashboard,
} from "@/modules/ee/analysis/lib/api-client";
import { dashboardKeys } from "@/modules/ee/analysis/lib/query";
import type { TDashboardWidget } from "@/modules/ee/analysis/types/analysis";
import { useDashboardEditor } from "./use-dashboard-editor";

vi.mock("react-i18next", () => {
  const t = (key: string) => key;
  return { useTranslation: () => ({ t }) };
});

vi.mock("@/modules/ee/analysis/lib/api-client", async (importActual) => ({
  ...(await importActual<typeof import("@/modules/ee/analysis/lib/api-client")>()),
  replaceDashboard: vi.fn(),
  getDashboard: vi.fn(),
  getDashboardPageAccess: vi.fn(),
  isStaleDashboardError: vi.fn(),
}));

const chart = (id: string, pageId = "p1"): TDashboardWidget =>
  ({
    id,
    kind: "chart",
    chartId: `chart_${id}`,
    dashboardId: "d1",
    pageId,
    layout: { x: 0, y: 0, w: 4, h: 12 },
    order: 0,
    chart: { type: "bar", name: `Chart ${id}`, feedbackDirectoryId: "dir" },
  }) as unknown as TDashboardWidget;

const page = (id: string, name: string, order = 0) => ({ id, name, order, limited: false, teamIds: [] });

const DASHBOARD: TAppDashboard = {
  id: "d1",
  workspaceId: "w1",
  name: "Matchday",
  updatedAt: "2026-01-01T00:00:00.000Z",
  filters: [],
  pages: [page("p1", "Overview")],
  widgets: [chart("a")],
};

const setup = (dashboard: TAppDashboard = DASHBOARD) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const refreshDashboard = vi.fn().mockResolvedValue(undefined);
  const waitForViewWrites = vi.fn().mockResolvedValue(undefined);
  const withFittedHeights = vi.fn((all: TDashboardWidget[]) => all);
  const Wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const hook = renderHook(
    () => useDashboardEditor({ dashboard, refreshDashboard, waitForViewWrites, withFittedHeights }),
    { wrapper: Wrapper }
  );
  return { ...hook, queryClient, refreshDashboard, waitForViewWrites };
};

const enterEdit = async (result: ReturnType<typeof setup>["result"]) => {
  await act(async () => {
    result.current.handleEnterEditMode();
  });
};

describe("useDashboardEditor", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/workspaces/w1/dashboards/d1");
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as never);
    vi.spyOn(window.history, "replaceState").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test("shows the dashboard as read until an edit starts", () => {
    const { result } = setup();
    expect(result.current.isEditing).toBe(false);
    expect(result.current.name).toBe("Matchday");
    expect(result.current.selectedPageId).toBe("p1");
    expect(result.current.pageWidgets.map((w) => w.id)).toEqual(["a"]);
    expect(result.current.hasChanges).toBe(false);
  });

  test("starts the edit from the cached dashboard once view writes are done", async () => {
    const { result, queryClient, waitForViewWrites } = setup();
    queryClient.setQueryData(dashboardKeys.detail("d1"), {
      ...DASHBOARD,
      widgets: [chart("a"), chart("dup")],
    });
    await enterEdit(result);
    expect(waitForViewWrites).toHaveBeenCalled();
    expect(result.current.isEditing).toBe(true);
    expect(result.current.widgets.map((w) => w.id)).toEqual(["a", "dup"]);
  });

  test("tracks draft changes and drops them on cancel", async () => {
    const { result } = setup();
    await enterEdit(result);
    act(() => result.current.handleNameChange("Renamed"));
    expect(result.current.hasChanges).toBe(true);
    act(() => result.current.handleRemoveWidget("a"));
    expect(result.current.widgets).toEqual([]);
    act(() => result.current.handleCancel());
    expect(result.current.isEditing).toBe(false);
    expect(result.current.name).toBe("Matchday");
    expect(result.current.widgets.map((w) => w.id)).toEqual(["a"]);
  });

  test("adds, renames and deletes pages in the draft", async () => {
    const { result } = setup();
    await enterEdit(result);
    act(() => result.current.handleAddPage());
    expect(result.current.pages).toHaveLength(2);
    const added = result.current.pages[1];
    expect(window.history.replaceState).toHaveBeenCalled();

    act(() => result.current.handleRenamePage(added.id, "Details"));
    expect(result.current.pages[1].name).toBe("Details");

    act(() => result.current.askDeletePage(added.id));
    expect(result.current.isDeletePageOpen).toBe(true);
    expect(result.current.pageToDelete?.id).toBe(added.id);
    act(() => result.current.handleConfirmDeletePage());
    expect(result.current.pages).toHaveLength(1);
    expect(result.current.isDeletePageOpen).toBe(false);
  });

  test("adds a text block to the selected page", async () => {
    const { result } = setup();
    await enterEdit(result);
    act(() => result.current.handleAddBlock("text"));
    expect(result.current.widgets.map((w) => w.kind)).toEqual(["chart", "text"]);
    expect(result.current.widgets[1].pageId).toBe("p1");
  });

  test("refuses to save without a name", async () => {
    const { result } = setup();
    await enterEdit(result);
    act(() => result.current.handleNameChange("  "));
    await act(() => result.current.handleSave());
    expect(replaceDashboard).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("workspace.analysis.dashboards.dashboard_name_required");
  });

  test("saves against the version the edit started from, then leaves edit mode", async () => {
    const { result, queryClient } = setup();
    vi.mocked(replaceDashboard).mockResolvedValue({ ...DASHBOARD, name: "Renamed" });
    await enterEdit(result);
    act(() => result.current.handleNameChange("Renamed "));
    await act(() => result.current.handleSave());
    expect(replaceDashboard).toHaveBeenCalledWith(
      "d1",
      expect.objectContaining({ name: "Renamed", expectedUpdatedAt: DASHBOARD.updatedAt })
    );
    expect(queryClient.getQueryData(dashboardKeys.detail("d1"))).toMatchObject({ name: "Renamed" });
    expect(result.current.isEditing).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });

  test("offers the latest version when the save is stale, and saves over it on request", async () => {
    const latest: TAppDashboard = {
      ...DASHBOARD,
      updatedAt: "2026-02-01T00:00:00.000Z",
      widgets: [chart("a"), chart("theirs")],
    };
    const { result } = setup();
    vi.mocked(replaceDashboard).mockRejectedValueOnce(new Error("stale"));
    vi.mocked(isStaleDashboardError).mockReturnValueOnce(true);
    vi.mocked(getDashboard).mockResolvedValue(latest);
    await enterEdit(result);
    act(() => result.current.handleNameChange("Mine"));
    await act(() => result.current.handleSave());

    expect(result.current.isStale).toBe(true);
    expect(result.current.isEditing).toBe(true);
    expect(result.current.removedByOverwrite).toEqual(["Chart theirs"]);

    vi.mocked(replaceDashboard).mockResolvedValueOnce(latest);
    await act(async () => {
      result.current.handleSaveAnyway();
    });
    expect(replaceDashboard).toHaveBeenLastCalledWith(
      "d1",
      expect.objectContaining({ name: "Mine", expectedUpdatedAt: latest.updatedAt })
    );
    expect(result.current.isStale).toBe(false);
    expect(result.current.isEditing).toBe(false);
  });

  test("reloading the latest version discards the edit", async () => {
    const latest = { ...DASHBOARD, updatedAt: "2026-02-01T00:00:00.000Z" };
    const { result, queryClient, refreshDashboard } = setup();
    vi.mocked(replaceDashboard).mockRejectedValueOnce(new Error("stale"));
    vi.mocked(isStaleDashboardError).mockReturnValueOnce(true);
    vi.mocked(getDashboard).mockResolvedValue(latest);
    await enterEdit(result);
    await act(() => result.current.handleSave());

    act(() => result.current.handleReloadLatest());
    expect(queryClient.getQueryData(dashboardKeys.detail("d1"))).toEqual(latest);
    expect(refreshDashboard).toHaveBeenCalled();
    expect(result.current.isStale).toBe(false);
    expect(result.current.isEditing).toBe(false);
  });

  test("a failed save keeps the edit open and says so", async () => {
    const { result } = setup();
    vi.mocked(replaceDashboard).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(isStaleDashboardError).mockReturnValueOnce(false);
    await enterEdit(result);
    await act(() => result.current.handleSave());
    expect(toast.error).toHaveBeenCalled();
    expect(result.current.isEditing).toBe(true);
    expect(result.current.isStale).toBe(false);
  });
});

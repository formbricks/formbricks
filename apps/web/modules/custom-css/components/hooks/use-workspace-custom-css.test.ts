/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type TCustomCssInput } from "@formbricks/types/custom-css";
import { getWorkspaceCustomCss, updateWorkspaceCustomCss } from "../lib/api-client";
import { useWorkspaceCustomCssEditor } from "./use-workspace-custom-css";

vi.mock("../lib/api-client", () => ({ getWorkspaceCustomCss: vi.fn(), updateWorkspaceCustomCss: vi.fn() }));
vi.mock("./use-custom-css-validation", () => ({ useCustomCssValidation: () => ({ status: "valid" }) }));

const saved = { light: ".a { color: red }", dark: null };
const edited = { light: ".a { color: blue }", dark: "" };

const resource = (workspaceId: string, customCss: TCustomCssInput | null) => ({
  workspaceId,
  customCss,
  previous: null,
  status: "ok" as const,
  canEdit: true,
  planAllowed: true,
});

/** Mounts the editor the way the Appearance page does, with a fresh query cache like a new visit. */
const visit = async (workspaceId: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const view = renderHook(() => useWorkspaceCustomCssEditor({ workspaceId, enabled: true }), { wrapper });
  await waitFor(() => expect(view.result.current.isLoading).toBe(false));
  return view;
};

describe("useWorkspaceCustomCssEditor: unsaved drafts across visits", () => {
  beforeEach(() => {
    vi.mocked(getWorkspaceCustomCss).mockImplementation(async ({ workspaceId }) =>
      resource(workspaceId, saved)
    );
  });

  test("a draft left unsaved is back on the next visit, until it is discarded", async () => {
    const first = await visit("ws_discard");
    act(() => first.result.current.setDraft(edited));
    first.unmount();

    const second = await visit("ws_discard");
    expect(second.result.current.draft).toEqual(edited);
    expect(second.result.current.isDraftRestored).toBe(true);
    expect(second.result.current.changeKind).toBe("edit");

    act(() => second.result.current.setDraft({ ...edited, dark: ".b {}" }));
    expect(second.result.current.isDraftRestored).toBe(false);

    act(() => second.result.current.resetDraft());
    second.unmount();

    const third = await visit("ws_discard");
    expect(third.result.current.draft).toEqual({ light: saved.light, dark: "" });
    expect(third.result.current.isDraftRestored).toBe(false);
  });

  test("saving forgets the draft", async () => {
    vi.mocked(updateWorkspaceCustomCss).mockResolvedValue({
      resource: resource("ws_save", { light: edited.light, dark: null }),
      warnings: [],
    });
    const first = await visit("ws_save");
    act(() => first.result.current.setDraft(edited));
    await act(async () => {
      await first.result.current.save({ light: edited.light, dark: null });
    });
    first.unmount();

    vi.mocked(getWorkspaceCustomCss).mockResolvedValue(
      resource("ws_save", { light: edited.light, dark: null })
    );
    const second = await visit("ws_save");
    expect(second.result.current.isDraftRestored).toBe(false);
    expect(second.result.current.changeKind).toBe("unchanged");
  });

  test("a draft is not offered back once other CSS has been saved since", async () => {
    const first = await visit("ws_stale");
    act(() => first.result.current.setDraft(edited));
    first.unmount();

    vi.mocked(getWorkspaceCustomCss).mockResolvedValue(resource("ws_stale", { light: ".c {}", dark: null }));
    const second = await visit("ws_stale");
    expect(second.result.current.draft).toEqual({ light: ".c {}", dark: "" });
    expect(second.result.current.isDraftRestored).toBe(false);
  });
});

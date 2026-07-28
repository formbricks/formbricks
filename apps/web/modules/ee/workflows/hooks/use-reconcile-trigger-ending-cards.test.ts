/**
 * @vitest-environment jsdom
 */
import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider, createStore, useAtomValue } from "jotai";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { setWorkflowDefinitionAtom, workflowDefinitionAtom } from "@/modules/ee/workflows/state/editor";
import { createWrapper, newQueryClient } from "./test-utils";
import { useReconcileTriggerEndingCards } from "./use-reconcile-trigger-ending-cards";

const toastSuccess = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: { success: (msg: string) => toastSuccess(msg), error: vi.fn() },
}));
vi.mock("react-i18next", () => {
  // Stable identity: `t` is an effect dependency, and a per-render one would re-run the reconcile.
  const translation = { t: (key: string) => key };
  return { useTranslation: () => translation };
});

const SURVEY_ID = "survey_1";
const endingsQueryKey = (surveyId: string) => ["workflow-trigger", "survey-endings", surveyId];

const buildDefinition = (endingCardIds: string[]): TWorkflowDefinition =>
  ({
    schemaVersion: 1,
    trigger: {
      id: "trigger_1",
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: SURVEY_ID, endingCardIds },
    },
    nodes: [],
    edges: [],
    entryNodeId: "trigger_1",
  }) as unknown as TWorkflowDefinition;

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const surveyWithEndings = (endingIds: string[]) =>
  jsonResponse({
    data: {
      defaultLanguage: "en",
      endings: endingIds.map((id) => ({ id, type: "endScreen", headline: { en: id } })),
    },
  });

/**
 * Renders the hook against a live editor store and feeds the atom's definition back in, so the
 * reconcile's own write re-enters the effect — a reconcile that never settles would loop here.
 */
const renderReconcile = ({
  definition,
  isEditable = true,
  queryClient = newQueryClient(),
}: {
  definition: TWorkflowDefinition | null;
  isEditable?: boolean;
  queryClient?: QueryClient;
}) => {
  const store = createStore();
  store.set(setWorkflowDefinitionAtom, definition);

  const QueryWrapper = createWrapper(queryClient);
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) =>
    createElement(Provider, { store }, createElement(QueryWrapper, null, children));

  const view = renderHook(
    () => {
      const current = useAtomValue(workflowDefinitionAtom);
      useReconcileTriggerEndingCards({ definition: current, isEditable });
      return current?.trigger?.config.endingCardIds;
    },
    { wrapper }
  );
  return { store, ...view };
};

beforeEach(() => {
  toastSuccess.mockClear();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useReconcileTriggerEndingCards", () => {
  test("prunes ids whose ending was deleted from the survey and says so", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_new"]));

    const { result } = renderReconcile({ definition: buildDefinition(["end_deleted", "end_new"]) });

    await waitFor(() => expect(result.current).toEqual(["end_new"]));
    expect(toastSuccess).toHaveBeenCalledWith("workspace.workflows.trigger_ending_cards_pruned");
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  test("warns that the trigger widened when every referenced ending is gone", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_other"]));

    const { result } = renderReconcile({ definition: buildDefinition(["end_deleted"]) });

    // An empty list means "all endings", so clearing the last id is a widening, not a tidy-up.
    await waitFor(() => expect(result.current).toEqual([]));
    expect(toastSuccess).toHaveBeenCalledWith("workspace.workflows.trigger_ending_cards_pruned_all");
  });

  test("drops duplicate ids without claiming an ending went missing", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_1"]));

    const { result } = renderReconcile({ definition: buildDefinition(["end_1", "end_1"]) });

    await waitFor(() => expect(result.current).toEqual(["end_1"]));
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  test("leaves a clean selection untouched and stays quiet", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_1", "end_2"]));

    const { result } = renderReconcile({ definition: buildDefinition(["end_1"]) });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    expect(result.current).toEqual(["end_1"]);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  test("keeps stale ids when the definition cannot be edited", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_new"]));

    const { result } = renderReconcile({
      definition: buildDefinition(["end_deleted"]),
      isEditable: false,
    });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    expect(result.current).toEqual(["end_deleted"]);
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  test("keeps stale ids when the survey lookup fails — a failed fetch is not 'no endings'", async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ status: 500, detail: "boom" }, 500));

    const { result } = renderReconcile({ definition: buildDefinition(["end_deleted"]) });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    expect(result.current).toEqual(["end_deleted"]);
  });

  test("does not fetch when the trigger targets all endings", async () => {
    const { result } = renderReconcile({ definition: buildDefinition([]) });

    await waitFor(() => expect(result.current).toEqual([]));
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
  });

  test("ignores endings that resolved for a different survey", async () => {
    const queryClient = newQueryClient();
    // Cached under this survey's key but carrying another survey's id — the guard must refuse it
    // rather than prune the selection against the wrong survey's endings.
    queryClient.setQueryData(endingsQueryKey(SURVEY_ID), { surveyId: "survey_other", endings: [] });
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => undefined) as never);

    const { result } = renderReconcile({ definition: buildDefinition(["end_deleted"]), queryClient });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    expect(result.current).toEqual(["end_deleted"]);
  });
});

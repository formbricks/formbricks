/**
 * @vitest-environment jsdom
 */
import { QueryClient } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { Provider, createStore, useAtomValue } from "jotai";
import { type ReactNode, createElement } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import {
  prunedTriggerEndingCardIdsAtom,
  setWorkflowDefinitionAtom,
  workflowDefinitionAtom,
} from "@/modules/ee/workflows/state/editor";
import { createWrapper, newQueryClient } from "./test-utils";
import { useReconcileTriggerEndingCards } from "./use-reconcile-trigger-ending-cards";

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

// Renders the hook against a live editor store, feeding the atom's definition back in so the
// reconcile's own write re-enters the effect — a reconcile that never settles would loop here.
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
      return {
        endingCardIds: current?.trigger?.config.endingCardIds,
        pruned: useAtomValue(prunedTriggerEndingCardIdsAtom),
      };
    },
    { wrapper }
  );
  return { store, ...view };
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useReconcileTriggerEndingCards", () => {
  test("prunes ids whose ending was deleted from the survey and records them", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_new"]));

    const { result } = renderReconcile({ definition: buildDefinition(["end_deleted", "end_new"]) });

    await waitFor(() => expect(result.current.endingCardIds).toEqual(["end_new"]));
    expect(result.current.pruned).toEqual(["end_deleted"]);
  });

  test("records the drop when every referenced ending is gone", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_other"]));

    const { result } = renderReconcile({ definition: buildDefinition(["end_deleted"]) });

    // An empty list means "all endings", so clearing the last id widens the trigger. Publishing
    // the dropped id is what lets the form keep asking for a specific pick.
    await waitFor(() => expect(result.current.endingCardIds).toEqual([]));
    expect(result.current.pruned).toEqual(["end_deleted"]);
  });

  test("drops duplicate ids without claiming an ending went missing", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_1"]));

    const { result } = renderReconcile({ definition: buildDefinition(["end_1", "end_1"]) });

    await waitFor(() => expect(result.current.endingCardIds).toEqual(["end_1"]));
    expect(result.current.pruned).toEqual([]);
  });

  test("leaves a clean selection untouched and reports no drift", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_1", "end_2"]));

    const { result } = renderReconcile({ definition: buildDefinition(["end_1"]) });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    expect(result.current.endingCardIds).toEqual(["end_1"]);
    expect(result.current.pruned).toEqual([]);
  });

  test("keeps stale ids when the definition cannot be edited", async () => {
    vi.mocked(global.fetch).mockResolvedValue(surveyWithEndings(["end_new"]));

    const { result } = renderReconcile({
      definition: buildDefinition(["end_deleted"]),
      isEditable: false,
    });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    expect(result.current.endingCardIds).toEqual(["end_deleted"]);
    expect(result.current.pruned).toEqual([]);
  });

  test("keeps stale ids when the survey lookup fails — a failed fetch is not 'no endings'", async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ status: 500, detail: "boom" }, 500));

    const { result } = renderReconcile({ definition: buildDefinition(["end_deleted"]) });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    expect(result.current.endingCardIds).toEqual(["end_deleted"]);
    expect(result.current.pruned).toEqual([]);
  });

  test("keeps stale ids when the endings response shape is malformed — not 'no endings'", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({ data: { defaultLanguage: "en", endings: "not-an-array" } })
    );

    const { result } = renderReconcile({ definition: buildDefinition(["end_deleted"]) });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    expect(result.current.endingCardIds).toEqual(["end_deleted"]);
    expect(result.current.pruned).toEqual([]);
  });

  test("does not fetch when the trigger targets all endings", async () => {
    const { result } = renderReconcile({ definition: buildDefinition([]) });

    await waitFor(() => expect(result.current.endingCardIds).toEqual([]));
    expect(vi.mocked(global.fetch)).not.toHaveBeenCalled();
    expect(result.current.pruned).toEqual([]);
  });

  test("ignores endings that resolved for a different survey", async () => {
    const queryClient = newQueryClient();
    // Cached under this survey's key but carrying another survey's id — the guard must refuse it
    // rather than prune the selection against the wrong survey's endings.
    queryClient.setQueryData(endingsQueryKey(SURVEY_ID), { surveyId: "survey_other", endings: [] });
    vi.mocked(global.fetch).mockReturnValue(new Promise(() => undefined) as never);

    const { result } = renderReconcile({ definition: buildDefinition(["end_deleted"]), queryClient });

    await waitFor(() => expect(vi.mocked(global.fetch)).toHaveBeenCalled());
    expect(result.current.endingCardIds).toEqual(["end_deleted"]);
    expect(result.current.pruned).toEqual([]);
  });
});

/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import { type TDraftStreamEvent, useDraftCreation } from "./use-draft-creation";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const payload = {
  name: "Imported",
  blocks: [{ name: "Block", elements: [{ type: "openText", headline: "Q" }] }],
} as unknown as TV3CreateSurveyBody;

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) },
    children
  );

type TInput = { fileName: string };
type TReport = { source: { kind: string; fileName: string }; issues: unknown[] };

const scripted = (events: TDraftStreamEvent<TReport>[]) =>
  vi.fn(async (_input: TInput, { onEvent }: { onEvent: (event: TDraftStreamEvent<TReport>) => void }) => {
    events.forEach(onEvent);
  });

type TCreate = (payload: TV3CreateSurveyBody) => Promise<{ id: string }>;

const renderDraftHook = (
  overrides: {
    canSubmit?: boolean;
    stream?: ReturnType<typeof scripted>;
    create?: ReturnType<typeof vi.fn<TCreate>>;
  } = {}
) => {
  const stream = overrides.stream ?? scripted([]);
  const create = overrides.create ?? vi.fn<TCreate>(async () => ({ id: "survey1" }));
  const onSuccess = vi.fn();
  const hook = renderHook(
    () =>
      useDraftCreation<TInput, TReport>({
        stream,
        create,
        canSubmit: overrides.canSubmit ?? true,
        getSourceLabel: (input) => input.fileName,
        sourceKind: "file",
        onSuccess,
      }),
    { wrapper }
  );
  return { ...hook, stream, create, onSuccess };
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

describe("useDraftCreation", () => {
  test("the injected canSubmit gates submit and regenerate", async () => {
    const { result, stream } = renderDraftHook({ canSubmit: false });

    expect(result.current.canCreate).toBe(false);
    await act(async () => result.current.submit({ fileName: "survey.qsf" }));
    act(() => result.current.regenerate({ fileName: "survey.qsf" }));

    expect(stream).not.toHaveBeenCalled();
  });

  test("labels the draft with the source and keeps the report from done", async () => {
    const report: TReport = { source: { kind: "qsf", fileName: "survey.qsf" }, issues: [] };
    const stream = scripted([
      { type: "start" },
      {
        type: "partial",
        draft: {
          name: "Imported",
          blocks: [{ name: "B", questions: [{ type: "openText", headline: "Q" }] }],
        } as never,
      },
      { type: "done", payload, report },
    ]);
    const { result } = renderDraftHook({ stream });

    await act(async () => result.current.submit({ fileName: "survey.qsf" }));

    await waitFor(() => expect(result.current.status).toBe("review"));
    expect(result.current.sourceLabel).toBe("survey.qsf");
    expect(result.current.state.sourceKind).toBe("file");
    expect(result.current.report).toBe(report);
    expect(result.current.draft.questions).toHaveLength(1);
  });

  test("creating hands the payload to the injected create and reports success", async () => {
    const stream = scripted([{ type: "done", payload }]);
    const create = vi.fn<TCreate>(async () => ({ id: "survey42" }));
    const { result, onSuccess } = renderDraftHook({ stream, create });

    await act(async () => result.current.submit({ fileName: "survey.qsf" }));
    await waitFor(() => expect(result.current.status).toBe("review"));
    await act(async () => result.current.handleOpenInEditor());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("survey42"));
    expect(create).toHaveBeenCalledWith(payload);
  });

  test("regenerate without an argument replays the last input", async () => {
    const stream = scripted([{ type: "done", payload }]);
    const { result } = renderDraftHook({ stream });

    await act(async () => result.current.submit({ fileName: "survey.qsf" }));
    await waitFor(() => expect(result.current.status).toBe("review"));
    await act(async () => result.current.regenerate());

    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream.mock.calls[1][0]).toEqual({ fileName: "survey.qsf" });
  });

  test("regenerate keeps the source kind it was given", async () => {
    const stream = scripted([{ type: "done", payload }]);
    const { result } = renderDraftHook({ stream });

    await act(async () => result.current.submit({ fileName: "survey.qsf" }));
    await waitFor(() => expect(result.current.status).toBe("review"));
    await act(async () => result.current.regenerate());

    await waitFor(() => expect(result.current.status).toBe("review"));
    expect(stream).toHaveBeenCalledTimes(2);
    expect(result.current.state.sourceKind).toBe("file");
  });

  test("an in-band error event maps to a message and returns to idle", async () => {
    const stream = scripted([{ type: "error", code: "ai_quota_exceeded" }]);
    const { result } = renderDraftHook({ stream });

    await act(async () => result.current.submit({ fileName: "survey.qsf" }));

    await waitFor(() =>
      expect(result.current.errorMessage).toBe("workspace.surveys.ai_create.ai_rate_limited")
    );
    expect(result.current.status).toBe("idle");
  });
});

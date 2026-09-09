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

const scripted = (events: TDraftStreamEvent[]) =>
  vi.fn(async (_input: TInput, { onEvent }: { onEvent: (event: TDraftStreamEvent) => void }) => {
    events.forEach(onEvent);
  });

type TCreate = (payload: TV3CreateSurveyBody, report: unknown) => Promise<{ id: string }>;

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
      useDraftCreation<TInput>({
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
    await act(async () => result.current.submit({ fileName: "a.json" }));
    act(() => result.current.regenerate({ fileName: "a.json" }));

    expect(stream).not.toHaveBeenCalled();
  });

  test("labels the draft with the source and keeps the report from done", async () => {
    const report = { issues: [{ code: "settings_not_exported" }] };
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

    await act(async () => result.current.submit({ fileName: "survey.formbricks.json" }));

    await waitFor(() => expect(result.current.status).toBe("review"));
    expect(result.current.sourceLabel).toBe("survey.formbricks.json");
    expect(result.current.state.sourceKind).toBe("file");
    expect(result.current.report).toBe(report);
    expect(result.current.draft.questions).toHaveLength(1);
  });

  test("partials with a blockOffset append rows from later chunks", async () => {
    const block = (headline: string) => ({ blocks: [{ name: "B", questions: [{ type: "nps", headline }] }] });
    const stream = scripted([
      { type: "partial", draft: block("One") as never },
      { type: "partial", draft: block("Two") as never, blockOffset: 1 },
      { type: "done", payload },
    ]);
    const { result } = renderDraftHook({ stream });

    await act(async () => result.current.submit({ fileName: "long.docx" }));

    await waitFor(() => expect(result.current.status).toBe("review"));
    expect(result.current.draft.questions.map((question) => question.headline)).toEqual(["One", "Two"]);
  });

  test("a partial marked replace swaps the streamed rows for the resolved document", async () => {
    const streamed = {
      blocks: [
        {
          name: "A",
          questions: [
            { type: "openText", headline: "One" },
            { type: "nps", headline: "Two" },
          ],
        },
      ],
    };
    const resolved = {
      blocks: [
        { name: "A", questions: [{ type: "openText", headline: "One" }] },
        { name: "Two", questions: [{ type: "nps", headline: "Two" }] },
      ],
    };
    const stream = scripted([
      { type: "partial", draft: streamed as never },
      { type: "partial", draft: resolved as never, replace: true },
      { type: "done", payload },
    ]);
    const { result } = renderDraftHook({ stream });

    await act(async () => result.current.submit({ fileName: "doc.docx" }));

    await waitFor(() => expect(result.current.status).toBe("review"));
    expect(result.current.draft.questions.map((question) => [question.key, question.headline])).toEqual([
      ["0:0", "One"],
      ["1:0", "Two"],
    ]);
  });

  test("creating hands payload and report to the injected create and reports success", async () => {
    const report = { issues: [] };
    const stream = scripted([{ type: "done", payload, report }]);
    const create = vi.fn<TCreate>(async () => ({ id: "survey42" }));
    const { result, onSuccess } = renderDraftHook({ stream, create });

    await act(async () => result.current.submit({ fileName: "a.json" }));
    await waitFor(() => expect(result.current.status).toBe("review"));
    await act(async () => result.current.handleOpenInEditor());

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("survey42"));
    expect(create).toHaveBeenCalledWith(payload, report);
  });

  test("regenerate without an argument replays the last input", async () => {
    const stream = scripted([{ type: "done", payload }]);
    const { result } = renderDraftHook({ stream });

    await act(async () => result.current.submit({ fileName: "a.json" }));
    await waitFor(() => expect(result.current.status).toBe("review"));
    await act(async () => result.current.regenerate());

    expect(stream).toHaveBeenCalledTimes(2);
    expect(stream.mock.calls[1][0]).toEqual({ fileName: "a.json" });
  });

  test("an in-band error event maps to a message and returns to idle", async () => {
    const stream = scripted([{ type: "error", code: "unsupported_source" }]);
    const { result } = renderDraftHook({ stream });

    await act(async () => result.current.submit({ fileName: "a.png" }));

    await waitFor(() =>
      expect(result.current.errorMessage).toBe("workspace.surveys.import.errors.unsupported_source")
    );
    expect(result.current.status).toBe("idle");
  });
});

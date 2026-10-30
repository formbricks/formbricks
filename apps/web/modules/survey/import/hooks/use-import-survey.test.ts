/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurveyImportStreamEvent } from "@/app/api/internal/surveys/import/lib/events";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import type { TSurveyImportDraft } from "@/modules/survey/import/core/draft";
import {
  SurveyImportRequestError,
  streamSurveyImportFile,
} from "@/modules/survey/import/lib/import-stream-client";
import { createV3Survey } from "@/modules/survey/list/lib/v3-surveys-client";
import { useImportSurvey } from "./use-import-survey";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/survey/import/lib/import-stream-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/import/lib/import-stream-client")>()),
  streamSurveyImportFile: vi.fn(),
}));

vi.mock("@/modules/survey/list/lib/v3-surveys-client", () => ({
  createV3Survey: vi.fn(async () => ({ id: "survey1" })),
}));

const report = {
  source: { kind: "qsf" as const, fileName: "survey.qsf" },
  summary: { blocks: 1, questions: 1, languages: ["en-US"], logicRules: 0, hiddenFields: 0 },
  issues: [],
};

/** A partial draft: the hook only reads its blocks, and the create is mocked. */
const payload = {
  workspaceId: "w1",
  name: "Survey (imported)",
  blocks: [
    { name: "Block 1", elements: [{ id: "q1", type: "openText", headline: { "en-US": "<p>Hi</p>" } }] },
  ],
} as unknown as TSurveyImportDraft;

const qsfFile = (
  content = '{"SurveyEntry":{"SurveyName":"Survey"},"SurveyElements":[]}',
  name = "survey.qsf"
) => new File([content], name);

/** Scripts the import stream: events go to `onEvent` in order; a thrown error is a pre-stream refusal. */
const streamWith = (events: TSurveyImportStreamEvent[], refusal?: Error) => {
  vi.mocked(streamSurveyImportFile).mockImplementation(async (_body, { onEvent }) => {
    if (refusal) throw refusal;
    events.forEach(onEvent);
  });
};

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, { client: new QueryClient() }, children);

const renderImport = () =>
  renderHook(() => useImportSurvey({ workspaceId: "w1", isAIAvailable: true, onSuccess: vi.fn() }), {
    wrapper,
  });

beforeEach(() => {
  vi.mocked(streamSurveyImportFile).mockReset();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

describe("useImportSurvey", () => {
  test("uploads the chosen file as it is, follows the stages and reviews the finished draft", async () => {
    streamWith([
      { type: "start", requestId: "r1" },
      { type: "progress", stage: "reading" },
      { type: "progress", stage: "ai" },
      { type: "progress", stage: "ai" },
      { type: "done", payload, report },
    ] as TSurveyImportStreamEvent[]);
    const { result } = renderImport();
    const file = qsfFile();

    await act(async () => result.current.selectFile(file));

    await waitFor(() => expect(result.current.status).toBe("review"));
    expect(vi.mocked(streamSurveyImportFile).mock.calls[0][0]).toEqual({ workspaceId: "w1", file });
    expect(vi.mocked(streamSurveyImportFile).mock.calls[0][0].file).toBe(file);
    expect(result.current.stage).toBe("ai");
    expect(result.current.draft.questions).toMatchObject([{ headline: "Hi", blockName: "Block 1" }]);
    expect(result.current.report).toEqual(report);
  });

  test("refuses a file by its name or size without uploading it", async () => {
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile("{}", "survey.json")));
    expect(result.current.errorCode).toBe("file_wrong_extension");

    await act(async () => result.current.selectFile(qsfFile("", "survey.qsf")));
    expect(result.current.errorCode).toBe("file_empty");

    expect(result.current.status).toBe("idle");
    expect(streamSurveyImportFile).not.toHaveBeenCalled();
  });

  test("leaves the content to the server: a .qsf that is not JSON is uploaded, and its 415 shown", async () => {
    streamWith(
      [],
      new SurveyImportRequestError(
        new V3ApiError({
          status: 415,
          detail: "This kind of file cannot be imported yet",
          code: "unsupported_media_type",
          invalid_params: [
            {
              name: "file",
              reason: "This kind of file cannot be imported yet",
              code: "file_type_unsupported",
              identifier: "csv",
            },
          ],
        }),
        null
      )
    );
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile("not json")));

    await waitFor(() => expect(result.current.errorCode).toBe("qsf_not_recognized"));
    expect(streamSurveyImportFile).toHaveBeenCalledTimes(1);
  });

  test("turns a refusal into the dialog's code and keeps its Retry-After", async () => {
    streamWith(
      [],
      new SurveyImportRequestError(
        new V3ApiError({ status: 429, detail: "wait", code: "too_many_requests" }),
        42
      )
    );
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile()));

    await waitFor(() => expect(result.current.errorCode).toBe("too_many_requests"));
    expect(result.current.retryAfterSeconds).toBe(42);
    expect(result.current.status).toBe("idle");
  });

  test("tells a file outgrowing the JSON budget apart from other refusals", async () => {
    streamWith(
      [],
      new SurveyImportRequestError(
        new V3ApiError({
          status: 422,
          detail: "The file is past one of the import's limits.",
          code: "unprocessable_content",
          invalid_params: [
            {
              name: "file.SurveyElements.0.Payload.ChoiceOrder",
              reason: "Too big",
              code: "file_limit_exceeded",
              identifier: "array_items",
            },
          ],
        }),
        null
      )
    );
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile()));

    await waitFor(() => expect(result.current.errorCode).toBe("file_too_complex"));
  });

  test("reports AI switched off since the page loaded, so the dialog shows the shared alert", async () => {
    streamWith(
      [],
      new SurveyImportRequestError(
        new V3ApiError({ status: 403, detail: "off", code: "ai_smart_tools_disabled" }),
        null
      )
    );
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile()));

    await waitFor(() => expect(result.current.aiUnavailableReason).toBe("not_enabled"));
  });

  test("keeps an in-stream error's Retry-After", async () => {
    streamWith([
      { type: "start", requestId: "r1" },
      { type: "error", code: "ai_quota_exceeded", detail: "quota", retryAfter: 30 },
    ] as TSurveyImportStreamEvent[]);
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile()));

    await waitFor(() => expect(result.current.errorCode).toBe("ai_quota_exceeded"));
    expect(result.current.retryAfterSeconds).toBe(30);
  });

  test("saves the reviewed draft as an import, as it came", async () => {
    streamWith([{ type: "done", payload, report }] as TSurveyImportStreamEvent[]);
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile()));
    await waitFor(() => expect(result.current.status).toBe("review"));
    act(() => result.current.handleOpenInEditor());

    await waitFor(() => expect(createV3Survey).toHaveBeenCalledWith(payload, "import"));
  });

  test("picking another file goes back to the drop zone", async () => {
    streamWith([{ type: "done", payload, report }] as TSurveyImportStreamEvent[]);
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile()));
    await waitFor(() => expect(result.current.status).toBe("review"));
    act(() => result.current.pickAnotherFile());

    expect(result.current.status).toBe("idle");
    expect(result.current.file).toBeNull();
    expect(result.current.report).toBeNull();
    // Nothing is kept behind the drop zone, so closing the dialog now discards nothing.
    expect(result.current.hasUnsavedWork).toBe(false);
  });
});

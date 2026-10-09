/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TQsfImportStreamEvent } from "@/app/api/internal/surveys/import/lib/events";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { QsfImportRequestError, streamQsfImport } from "@/modules/survey/import/lib/import-stream-client";
import type { TQsfDraftDocument } from "@/modules/survey/import/qsf/draft";
import { useImportSurvey } from "./use-import-survey";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/survey/import/lib/import-stream-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/survey/import/lib/import-stream-client")>()),
  streamQsfImport: vi.fn(),
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
} as unknown as TQsfDraftDocument;

const qsfFile = (
  content = '{"SurveyEntry":{"SurveyName":"Survey"},"SurveyElements":[]}',
  name = "survey.qsf"
) => new File([content], name);

/** Scripts the import stream: events go to `onEvent` in order; a thrown error is a pre-stream refusal. */
const streamWith = (events: TQsfImportStreamEvent[], refusal?: Error) => {
  vi.mocked(streamQsfImport).mockImplementation(async (_body, { onEvent }) => {
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
  vi.mocked(streamQsfImport).mockReset();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

describe("useImportSurvey", () => {
  test("sends the parsed file, follows the stages and reviews the finished draft", async () => {
    streamWith([
      { type: "start", requestId: "r1" },
      { type: "progress", stage: "reading" },
      { type: "progress", stage: "ai" },
      { type: "progress", stage: "ai" },
      { type: "done", payload, report },
    ] as TQsfImportStreamEvent[]);
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile()));

    await waitFor(() => expect(result.current.status).toBe("review"));
    expect(vi.mocked(streamQsfImport).mock.calls[0][0]).toEqual({
      workspaceId: "w1",
      fileName: "survey.qsf",
      qsf: { SurveyEntry: { SurveyName: "Survey" }, SurveyElements: [] },
    });
    expect(result.current.stage).toBe("ai");
    expect(result.current.draft.questions).toMatchObject([{ headline: "Hi", blockName: "Block 1" }]);
    expect(result.current.report).toEqual(report);
  });

  test("refuses a file that is not a QSF without uploading it", async () => {
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile("[1, 2]")));

    expect(result.current.errorCode).toBe("qsf_not_object");
    expect(result.current.status).toBe("idle");
    expect(streamQsfImport).not.toHaveBeenCalled();
  });

  test("turns a refusal into the dialog's code and keeps its Retry-After", async () => {
    streamWith(
      [],
      new QsfImportRequestError(
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

  test("splits a 400 for the file outgrowing the budget from other 400s", async () => {
    streamWith(
      [],
      new QsfImportRequestError(
        new V3ApiError({
          status: 400,
          detail: "Invalid request body",
          code: "bad_request",
          invalid_params: [{ name: "qsf.SurveyElements.0.Payload.ChoiceOrder", reason: "Too big" }],
        }),
        null
      )
    );
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile()));

    await waitFor(() => expect(result.current.errorCode).toBe("qsf_too_complex"));
  });

  test("reports AI switched off since the page loaded, so the dialog shows the shared alert", async () => {
    streamWith(
      [],
      new QsfImportRequestError(
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
    ] as TQsfImportStreamEvent[]);
    const { result } = renderImport();

    await act(async () => result.current.selectFile(qsfFile()));

    await waitFor(() => expect(result.current.errorCode).toBe("ai_quota_exceeded"));
    expect(result.current.retryAfterSeconds).toBe(30);
  });

  test("picking another file goes back to the drop zone", async () => {
    streamWith([{ type: "done", payload, report }] as TQsfImportStreamEvent[]);
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

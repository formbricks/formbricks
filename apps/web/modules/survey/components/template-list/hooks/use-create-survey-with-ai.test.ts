/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type ReactNode, createElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { TSurveyGenerationStreamEvent } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3CreateSurveyBody } from "@/app/api/v3/surveys/schemas";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { streamSurveyGeneration } from "@/modules/survey/components/template-list/lib/ai-generate-stream-client";
import { createV3Survey } from "@/modules/survey/list/lib/v3-surveys-client";
import { useCreateSurveyWithAI } from "./use-create-survey-with-ai";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/modules/survey/list/lib/v3-surveys-client", () => ({
  createV3Survey: vi.fn(),
}));

vi.mock("@/modules/survey/components/template-list/lib/ai-generate-stream-client", () => ({
  streamSurveyGeneration: vi.fn(),
}));

const submitEvent = {
  preventDefault: vi.fn(),
} as unknown as Parameters<ReturnType<typeof useCreateSurveyWithAI>["handleGenerate"]>[0];

const payload = {
  name: "Generated survey",
  blocks: [{ name: "Block", elements: [{ type: "openText", headline: "How was it?" }] }],
} as unknown as TV3CreateSurveyBody;

const questionSnapshot = (headline: string) => ({
  name: "Onboarding",
  blocks: [{ name: "Block", questions: [{ type: "openText", headline }] }],
});

/** Drive the hook with a scripted event sequence, as the real stream would. */
const emitEvents = (events: TSurveyGenerationStreamEvent[]) => {
  vi.mocked(streamSurveyGeneration).mockImplementation(async (_body, { onEvent }) => {
    events.forEach(onEvent);
  });
};

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(
    QueryClientProvider,
    { client: new QueryClient({ defaultOptions: { mutations: { retry: false } } }) },
    children
  );

const renderAiHook = (overrides: { isAIAvailable?: boolean; onSuccess?: () => void } = {}) =>
  renderHook(
    () =>
      useCreateSurveyWithAI({
        workspaceId: "workspace1",
        language: "en-US",
        isAIAvailable: overrides.isAIAvailable ?? true,
        onSuccess: overrides.onSuccess ?? vi.fn(),
      }),
    { wrapper }
  );

const submitWithPrompt = async (
  result: { current: ReturnType<typeof useCreateSurveyWithAI> },
  prompt = "  create an onboarding survey  "
) => {
  act(() => result.current.setPrompt(prompt));
  await act(async () => {
    result.current.handleGenerate(submitEvent);
  });
};

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  vi.mocked(createV3Survey).mockResolvedValue({ id: "survey1" });
  emitEvents([]);
  // Snapshots are dispatched on the next frame; run them immediately under test.
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
});

describe("useCreateSurveyWithAI", () => {
  test("does not submit when AI is unavailable", async () => {
    const { result } = renderAiHook({ isAIAvailable: false });

    expect(result.current.canCreate).toBe(false);
    await submitWithPrompt(result);

    expect(streamSurveyGeneration).not.toHaveBeenCalled();
  });

  test("does not submit a prompt that is too short, with AI available", async () => {
    // Asserted with AI on, so the length guard is what fails rather than the availability check.
    const { result } = renderAiHook();

    await submitWithPrompt(result, "abc");

    expect(result.current.canCreate).toBe(false);
    expect(streamSurveyGeneration).not.toHaveBeenCalled();
  });

  test("sends the trimmed prompt to the stream", async () => {
    const { result } = renderAiHook();

    await submitWithPrompt(result);

    expect(streamSurveyGeneration).toHaveBeenCalledWith(
      { workspaceId: "workspace1", prompt: "create an onboarding survey", type: "link", language: "en-US" },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  test("builds the draft from partial events and lands on review", async () => {
    emitEvents([
      { type: "start", requestId: "req_1" },
      { type: "partial", seq: 1, draft: questionSnapshot("How was onboarding?") as never },
      {
        type: "done",
        language: "en",
        payload,
        validation: { valid: true, invalid_params: [], languages: [] },
      },
    ]);
    const { result } = renderAiHook();

    await submitWithPrompt(result);

    await waitFor(() => expect(result.current.status).toBe("review"));
    expect(result.current.draft.name).toBe("Onboarding");
    expect(result.current.draft.questions[0].headline).toBe("How was onboarding?");
    // Nothing is written until the user asks for it.
    expect(createV3Survey).not.toHaveBeenCalled();
  });

  test("writes the survey only when the user opens it in the editor", async () => {
    const onSuccess = vi.fn();
    emitEvents([
      { type: "partial", seq: 1, draft: questionSnapshot("How was onboarding?") as never },
      {
        type: "done",
        language: "en",
        payload,
        validation: { valid: true, invalid_params: [], languages: [] },
      },
    ]);
    const { result } = renderAiHook({ onSuccess });

    await submitWithPrompt(result);
    await waitFor(() => expect(result.current.status).toBe("review"));

    await act(async () => {
      result.current.handleOpenInEditor();
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith("survey1"));
    expect(createV3Survey).toHaveBeenCalledWith(payload, "ai");
  });

  test("surfaces an in-band error event and discards the partial draft", async () => {
    emitEvents([
      { type: "partial", seq: 1, draft: questionSnapshot("Half written") as never },
      { type: "error", code: "ai_output_too_long", detail: "too long" },
    ]);
    const { result } = renderAiHook();

    await submitWithPrompt(result);

    await waitFor(() =>
      expect(result.current.errorMessage).toBe("workspace.surveys.ai_create.ai_output_too_long")
    );
    expect(result.current.status).toBe("idle");
    expect(result.current.draft.questions).toHaveLength(0);
  });

  test("keeps the prompt after a failure so the user can retry without retyping", async () => {
    vi.mocked(streamSurveyGeneration).mockRejectedValueOnce(
      new V3ApiError({ status: 503, detail: "unavailable", code: "ai_smart_tools_disabled" })
    );
    const { result } = renderAiHook();

    await submitWithPrompt(result);

    await waitFor(() =>
      expect(result.current.errorMessage).toBe("workspace.surveys.ai_create.ai_not_enabled")
    );
    expect(result.current.prompt).toBe("  create an onboarding survey  ");
  });

  test("stop keeps a partial draft so it can still be opened", async () => {
    emitEvents([{ type: "partial", seq: 1, draft: questionSnapshot("How was onboarding?") as never }]);
    const { result } = renderAiHook();

    await submitWithPrompt(result);
    act(() => result.current.handleStop());

    expect(result.current.status).toBe("review");
    expect(result.current.draft.questions).toHaveLength(1);
  });
});

describe("regenerating", () => {
  test("does not fire with a prompt the form would have rejected", async () => {
    // Reachable without touching Generate: edit the prompt, clear it, go back to the kept draft,
    // press Regenerate.
    emitEvents([
      { type: "partial", seq: 1, draft: questionSnapshot("How was it?") },
      { type: "done", language: "en-US", payload, validation: { valid: true } },
    ] as unknown as TSurveyGenerationStreamEvent[]);
    const { result } = renderAiHook();

    await submitWithPrompt(result);
    expect(result.current.status).toBe("review");

    act(() => result.current.handleEditPrompt());
    act(() => result.current.setPrompt(""));
    act(() => result.current.handleBackToDraft());

    const callsBefore = vi.mocked(streamSurveyGeneration).mock.calls.length;
    act(() => result.current.handleRegenerate());

    expect(vi.mocked(streamSurveyGeneration)).toHaveBeenCalledTimes(callsBefore);
    expect(result.current.status).toBe("review");
  });
});

describe("unsaved work", () => {
  test("is flagged through every state a reload would destroy", async () => {
    emitEvents([
      { type: "partial", seq: 1, draft: questionSnapshot("How was onboarding?") as never },
      {
        type: "done",
        language: "en",
        payload,
        validation: { valid: true, invalid_params: [], languages: [] },
      },
    ]);
    const { result } = renderAiHook();

    // Nothing generated yet: a typed prompt is cheap to retype, so no prompt.
    act(() => result.current.setPrompt("  create an onboarding survey  "));
    expect(result.current.hasUnsavedWork).toBe(false);

    await submitWithPrompt(result);
    await waitFor(() => expect(result.current.status).toBe("review"));
    expect(result.current.hasUnsavedWork).toBe(true);

    // Stepping back to the prompt keeps the draft, so it is still losable.
    act(() => result.current.handleEditPrompt());
    expect(result.current.hasKeptDraft).toBe(true);
    expect(result.current.hasUnsavedWork).toBe(true);
  });

  test("stays flagged while the survey is being written", async () => {
    // Reloading here loses the survey and the redirect that follows it.
    emitEvents([
      { type: "partial", seq: 1, draft: questionSnapshot("How was onboarding?") as never },
      {
        type: "done",
        language: "en",
        payload,
        validation: { valid: true, invalid_params: [], languages: [] },
      },
    ]);
    vi.mocked(createV3Survey).mockReturnValue(new Promise(() => undefined) as never);
    const { result } = renderAiHook();

    await submitWithPrompt(result);
    await waitFor(() => expect(result.current.status).toBe("review"));

    act(() => result.current.handleOpenInEditor());

    await waitFor(() => expect(result.current.status).toBe("creating"));
    expect(result.current.hasUnsavedWork).toBe(true);
  });
});

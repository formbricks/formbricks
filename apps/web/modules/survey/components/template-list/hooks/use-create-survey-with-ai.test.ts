/**
 * @vitest-environment jsdom
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  createV3Survey,
  generateSurveyCreatePayload,
  validateSurveyCreatePayload,
} from "@/modules/survey/list/lib/v3-surveys-client";
import { useCreateSurveyWithAI } from "./use-create-survey-with-ai";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("@/modules/survey/list/lib/v3-surveys-client", () => ({
  createV3Survey: vi.fn(),
  generateSurveyCreatePayload: vi.fn(),
  validateSurveyCreatePayload: vi.fn(),
}));

const submitEvent = {
  preventDefault: vi.fn(),
} as Parameters<ReturnType<typeof useCreateSurveyWithAI>["handleGenerate"]>[0];
const payload = { name: "Generated survey" };
const validGeneratedSurvey = {
  payload,
  validation: {
    valid: true,
    invalid_params: [],
    languages: [],
  },
};
const validCreateValidation = {
  valid: true,
  operation: "create",
  invalid_params: [],
};

describe("useCreateSurveyWithAI", () => {
  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    vi.clearAllMocks();
    vi.mocked(generateSurveyCreatePayload).mockResolvedValue(validGeneratedSurvey);
    vi.mocked(validateSurveyCreatePayload).mockResolvedValue(validCreateValidation);
    vi.mocked(createV3Survey).mockResolvedValue({ id: "survey1" });
  });

  test("does not submit when AI is unavailable or the prompt is too short", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useCreateSurveyWithAI({
        workspaceId: "workspace1",
        language: "en-US",
        isAIAvailable: false,
        onSuccess,
      })
    );

    expect(result.current.canCreate).toBe(false);

    await act(async () => {
      await result.current.handleGenerate(submitEvent);
    });

    expect(generateSurveyCreatePayload).not.toHaveBeenCalled();

    act(() => {
      result.current.setPrompt("abc");
    });

    expect(result.current.canCreate).toBe(false);
  });

  test("generates, validates, creates, and opens the generated survey", async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useCreateSurveyWithAI({
        workspaceId: "workspace1",
        language: "en-US",
        isAIAvailable: true,
        onSuccess,
      })
    );

    act(() => {
      result.current.setPrompt("  create an onboarding survey  ");
    });

    await act(async () => {
      await result.current.handleGenerate(submitEvent);
    });

    expect(generateSurveyCreatePayload).toHaveBeenCalledWith({
      workspaceId: "workspace1",
      prompt: "create an onboarding survey",
      type: "link",
      language: "en-US",
    });
    expect(validateSurveyCreatePayload).toHaveBeenCalledWith(payload);
    expect(createV3Survey).toHaveBeenCalledWith(payload);
    expect(onSuccess).toHaveBeenCalledWith("survey1");
    expect(result.current.submitLabel).toBe("workspace.surveys.ai_create.opening_editor");
  });

  test("shows an error when the generated survey payload is invalid", async () => {
    vi.mocked(generateSurveyCreatePayload).mockResolvedValueOnce({
      ...validGeneratedSurvey,
      validation: { ...validGeneratedSurvey.validation, valid: false },
    });

    const { result } = renderHook(() =>
      useCreateSurveyWithAI({
        workspaceId: "workspace1",
        language: "en-US",
        isAIAvailable: true,
        onSuccess: vi.fn(),
      })
    );

    act(() => {
      result.current.setPrompt("create an onboarding survey");
    });

    await act(async () => {
      await result.current.handleGenerate(submitEvent);
    });

    expect(result.current.errorMessage).toBe("workspace.surveys.ai_create.generated_payload_invalid");
    expect(createV3Survey).not.toHaveBeenCalled();

    act(() => {
      result.current.clearError();
    });

    expect(result.current.errorMessage).toBeNull();
  });

  test.each([
    ["ai_features_not_enabled", "workspace.surveys.ai_create.ai_not_in_plan"],
    ["ai_smart_tools_disabled", "workspace.surveys.ai_create.ai_not_enabled"],
    ["ai_instance_not_configured", "workspace.surveys.ai_create.ai_instance_not_configured"],
    ["ai_generated_payload_invalid", "workspace.surveys.ai_create.generated_payload_invalid"],
  ])("maps %s errors to the matching message", async (code, expectedMessage) => {
    vi.mocked(generateSurveyCreatePayload).mockRejectedValueOnce(
      new V3ApiError({ status: 403, detail: "API error", code })
    );

    const { result } = renderHook(() =>
      useCreateSurveyWithAI({
        workspaceId: "workspace1",
        language: "en-US",
        isAIAvailable: true,
        onSuccess: vi.fn(),
      })
    );

    act(() => {
      result.current.setPrompt("create an onboarding survey");
    });

    await act(async () => {
      await result.current.handleGenerate(submitEvent);
    });

    await waitFor(() => expect(result.current.errorMessage).toBe(expectedMessage));
  });

  test("uses the generic API error message for unexpected errors", async () => {
    vi.mocked(generateSurveyCreatePayload).mockRejectedValueOnce(new Error("Network failed"));

    const { result } = renderHook(() =>
      useCreateSurveyWithAI({
        workspaceId: "workspace1",
        language: "en-US",
        isAIAvailable: true,
        onSuccess: vi.fn(),
      })
    );

    act(() => {
      result.current.setPrompt("create an onboarding survey");
    });

    await act(async () => {
      await result.current.handleGenerate(submitEvent);
    });

    expect(result.current.errorMessage).toBe("Network failed");
  });
});

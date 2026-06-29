import { NoObjectGeneratedError } from "ai";
import { describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { AI_CHART_PROMPT_ERROR_CODE } from "./ai-chart-errors";
import { getAIChartPromptError } from "./ai-chart-errors.server";

vi.mock("server-only", () => ({}));

describe("getAIChartPromptError", () => {
  test("maps a NoObjectGeneratedError to the prompt error code", () => {
    const result = getAIChartPromptError(
      new NoObjectGeneratedError({
        message: "No object generated",
        response: { id: "test-id", timestamp: new Date(0), modelId: "test-model" },
        usage: {
          inputTokens: undefined,
          inputTokenDetails: {
            noCacheTokens: undefined,
            cacheReadTokens: undefined,
            cacheWriteTokens: undefined,
          },
          outputTokens: undefined,
          outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
          totalTokens: undefined,
        },
        finishReason: "stop",
      })
    );

    expect(result).toBeInstanceOf(InvalidInputError);
    expect(result?.message).toBe(AI_CHART_PROMPT_ERROR_CODE);
  });

  test("does not convert provider errors", () => {
    expect(getAIChartPromptError(new Error("billing disabled"))).toBeNull();
  });

  test("does not convert non-Error rejections", () => {
    expect(getAIChartPromptError("string failure")).toBeNull();
  });
});

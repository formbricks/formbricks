import { describe, expect, test } from "vitest";
import { AIOAuthTokenError, AIOutputTokenLimitError } from "@formbricks/ai";
import { TooManyRequestsError } from "@formbricks/types/errors";
import { classifyAIStreamFailure, isClientAbort } from "./ai-stream-errors";

describe("classifyAIStreamFailure", () => {
  test("classifies quota exhaustion and keeps Retry-After", () => {
    expect(classifyAIStreamFailure(new TooManyRequestsError("quota", 30))).toEqual({
      code: "ai_quota_exceeded",
      retryAfter: 30,
    });
  });

  test("classifies rejected provider credentials", () => {
    expect(
      classifyAIStreamFailure(
        new AIOAuthTokenError("token_request_failed", { statusCode: 401, tokenUrlHost: "idp.example" })
      )
    ).toEqual({ code: "ai_provider_auth_failed" });
  });

  test("classifies hitting the output token limit", () => {
    expect(classifyAIStreamFailure(new AIOutputTokenLimitError())).toEqual({ code: "ai_output_too_long" });
  });

  test("returns null for anything that is not an AI failure, so each route maps its own", () => {
    expect(classifyAIStreamFailure(new Error("Contains the prompt: secret text"))).toBeNull();
  });
});

describe("isClientAbort", () => {
  const abortedSignal = () => {
    const controller = new AbortController();
    controller.abort();
    return controller.signal;
  };

  test("treats any failure on an aborted request as a client abort", () => {
    expect(isClientAbort(abortedSignal())).toBe(true);
  });

  test("does not classify an active request as cancelled", () => {
    expect(isClientAbort(new AbortController().signal)).toBe(false);
  });
});

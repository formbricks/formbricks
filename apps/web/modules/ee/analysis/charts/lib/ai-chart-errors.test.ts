import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { getAIChartErrorMessage } from "./ai-chart-errors";

const t = (key: string) => `translated:${key}`;
const problem = (status: number, code: string, detail = "Server detail") =>
  new V3ApiError({ status, code, detail });

describe("AI chart errors", () => {
  test("reads a prompt the model could not use as the could-not-be-converted message", () => {
    expect(getAIChartErrorMessage(problem(422, "ai_generated_payload_invalid"), t)).toBe(
      "translated:workspace.analysis.charts.ai_prompt_could_not_be_converted"
    );
  });

  test("reads any 429 — provider quota or the per-minute limit — as try again shortly", () => {
    expect(getAIChartErrorMessage(problem(429, "too_many_requests"), t)).toBe(
      "translated:workspace.analysis.charts.ai_quota_exceeded"
    );
  });

  test("reads an AI gate the way every AI feature does", () => {
    expect(getAIChartErrorMessage(problem(403, "ai_smart_tools_disabled"), t)).toMatch(/^translated:/);
    expect(getAIChartErrorMessage(problem(403, "ai_smart_tools_disabled"), t)).not.toBe("Server detail");
  });

  test("falls back to the server's sentence, then to the generic one", () => {
    expect(getAIChartErrorMessage(problem(502, "bad_gateway"), t)).toBe("Server detail");
    expect(getAIChartErrorMessage(new Error("offline"), t)).toBe(
      "translated:common.something_went_wrong_please_try_again"
    );
  });
});

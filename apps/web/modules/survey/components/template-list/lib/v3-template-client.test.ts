import { afterEach, describe, expect, test, vi } from "vitest";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { createSurveyFromTemplate } from "./v3-template-client";

const workspaceId = "clxx1234567890123456789012";

function getJsonBody(init: unknown): unknown {
  return JSON.parse((init as RequestInit).body as string);
}

describe("createSurveyFromTemplate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("posts a trusted template create request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ data: { id: "survey_1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSurveyFromTemplate({
      workspaceId,
      templateId: "product-market-fit-superhuman",
      source: "catalog",
      surveyType: "app",
      defaultLanguage: "en-US",
    });

    expect(result).toEqual({ id: "survey_1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v3/surveys/templates");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    expect(getJsonBody(fetchMock.mock.calls[0][1])).toEqual({
      workspaceId,
      templateId: "product-market-fit-superhuman",
      source: "catalog",
      surveyType: "app",
      defaultLanguage: "en-US",
    });
  });

  test("returns useful messages for trusted template problem responses", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json(
        {
          status: 400,
          detail: "Template not found",
          code: "bad_request",
          requestId: "req_123",
          invalid_params: [{ name: "templateId", reason: "Unknown template for the requested source" }],
        },
        { status: 400 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await createSurveyFromTemplate({
        workspaceId,
        templateId: "missing",
        source: "catalog",
        surveyType: "app",
        defaultLanguage: "en-US",
      });
      throw new Error("Expected createSurveyFromTemplate to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(V3ApiError);
      expect(getV3ApiErrorMessage(error, "fallback")).toBe("Template not found");
      expect(error).toMatchObject({
        status: 400,
        code: "bad_request",
        requestId: "req_123",
        invalid_params: [{ name: "templateId", reason: "Unknown template for the requested source" }],
      });
    }
  });
});

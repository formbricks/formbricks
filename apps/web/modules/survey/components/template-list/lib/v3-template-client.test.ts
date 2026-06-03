import { afterEach, describe, expect, test, vi } from "vitest";
import type { TTemplate } from "@formbricks/types/templates";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { createSurveyFromTemplate } from "./v3-template-client";

const workspaceId = "clxx1234567890123456789012";
const template = {
  id: "feedback-template",
  name: "Feedback Template",
  description: "Collect product feedback",
  preset: {
    name: "Product Feedback",
    metadata: {
      title: { default: "Product Feedback" },
    },
    welcomeCard: {
      enabled: false,
    },
    blocks: [
      {
        id: "clbk1234567890123456789012",
        name: "Main Block",
        elements: [
          {
            id: "feedback",
            type: "openText",
            headline: { default: "What should we improve?" },
            required: true,
            inputType: "text",
          },
        ],
      },
    ],
    endings: [],
    hiddenFields: { enabled: false },
    variables: [],
  },
} as unknown as TTemplate;

const expectedPayload = {
  workspaceId,
  name: "Product Feedback",
  type: "app",
  defaultLanguage: "en-US",
  languages: [],
  metadata: {
    title: { "en-US": "Product Feedback" },
  },
  welcomeCard: {
    enabled: false,
  },
  blocks: [
    {
      id: "clbk1234567890123456789012",
      name: "Main Block",
      elements: [
        {
          id: "feedback",
          type: "openText",
          headline: { "en-US": "What should we improve?" },
          required: true,
          inputType: "text",
        },
      ],
    },
  ],
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
};

function getJsonBody(init: unknown): unknown {
  return JSON.parse((init as RequestInit).body as string);
}

describe("createSurveyFromTemplate", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("validates before creation and posts the canonical v3 create payload", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: { valid: true, invalid_params: [] } }))
      .mockResolvedValueOnce(Response.json({ data: { id: "survey_1" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await createSurveyFromTemplate({
      template,
      workspaceId,
      surveyType: "app",
      defaultLanguage: "en-US",
    });

    expect(result).toEqual({ id: "survey_1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v3/surveys/validate");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/v3/surveys");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
    });
    expect(getJsonBody(fetchMock.mock.calls[0][1])).toEqual({
      operation: "create",
      data: expectedPayload,
    });
    expect(getJsonBody(fetchMock.mock.calls[1][1])).toEqual(expectedPayload);
  });

  test("does not create when validation returns invalid params", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({
        data: {
          valid: false,
          invalid_params: [{ name: "blocks.0.elements.0.headline", reason: "Missing translation" }],
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      createSurveyFromTemplate({
        template,
        workspaceId,
        surveyType: "app",
        defaultLanguage: "en-US",
      })
    ).rejects.toMatchObject({
      status: 400,
      message: "Invalid template survey document: blocks.0.elements.0.headline: Missing translation",
      invalid_params: [{ name: "blocks.0.elements.0.headline", reason: "Missing translation" }],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test("returns useful messages for v3 problem responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: { valid: true, invalid_params: [] } }))
      .mockResolvedValueOnce(
        Response.json(
          {
            status: 422,
            detail: "blocks.0.elements.0.id references an unknown element",
            code: "unprocessable_entity",
            requestId: "req_123",
            invalid_params: [{ name: "blocks.0.logic.0.actions.0.target", reason: "Unknown block" }],
          },
          { status: 422 }
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    try {
      await createSurveyFromTemplate({
        template,
        workspaceId,
        surveyType: "app",
        defaultLanguage: "en-US",
      });
      throw new Error("Expected createSurveyFromTemplate to reject");
    } catch (error) {
      expect(error).toBeInstanceOf(V3ApiError);
      expect(getV3ApiErrorMessage(error, "fallback")).toBe(
        "blocks.0.elements.0.id references an unknown element"
      );
      expect(error).toMatchObject({
        status: 422,
        code: "unprocessable_entity",
        requestId: "req_123",
        invalid_params: [{ name: "blocks.0.logic.0.actions.0.target", reason: "Unknown block" }],
      });
    }
  });
});

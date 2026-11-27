import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { translateSurveyFields } from "./api-client";

const WORKSPACE_ID = "clwork1111111111111111111";
const TRANSLATE_URL = `/api/internal/ai-translations?workspaceId=${WORKSPACE_ID}`;
const BODY = {
  fields: [{ path: "blocks.0.elements.0.headline", defaultText: "Hello", isRichText: false }],
  sourceLanguage: "English",
  targetLanguage: "German",
};

describe("translateSurveyFields", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("posts the fields to the workspace's translation route and unwraps the translations", async () => {
    routeFetch({
      [`POST ${TRANSLATE_URL}`]: [
        json({ data: { translations: { "blocks.0.elements.0.headline": "Hallo" } } }),
      ],
    });

    await expect(translateSurveyFields(WORKSPACE_ID, BODY)).resolves.toEqual({
      translations: { "blocks.0.elements.0.headline": "Hallo" },
    });
    expect(JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]?.body as string)).toEqual(BODY);
  });

  test("sets no client timeout: a generation may outlast the default write timeout", async () => {
    routeFetch({ [`POST ${TRANSLATE_URL}`]: [json({ data: { translations: {} } })] });

    await translateSurveyFields(WORKSPACE_ID, BODY);

    expect(vi.mocked(global.fetch).mock.calls[0][1]?.signal).toBeUndefined();
  });

  test("throws the problem's code for the dialog to word", async () => {
    routeFetch({
      [`POST ${TRANSLATE_URL}`]: [
        json({ status: 422, detail: "Too much text", code: "ai_output_too_long" }, 422),
      ],
    });

    const error = await translateSurveyFields(WORKSPACE_ID, BODY).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(V3ApiError);
    expect(error).toMatchObject({ status: 422, code: "ai_output_too_long" });
  });
});

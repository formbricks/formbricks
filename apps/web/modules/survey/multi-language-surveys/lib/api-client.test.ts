import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { createLanguage, deleteLanguage, listLanguageSurveys, updateLanguage } from "./api-client";

const WORKSPACE_ID = "clwork1111111111111111111";
const LANGUAGE_ID = "cllang1111111111111111111";
const LANGUAGE = {
  id: LANGUAGE_ID,
  code: "de-DE",
  alias: null,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

const sentBody = () => JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]?.body as string);

describe("languages API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("creates a language in the workspace named in the query", async () => {
    routeFetch({
      [`POST /api/internal/languages?workspaceId=${WORKSPACE_ID}`]: [json({ data: LANGUAGE }, 201)],
    });

    await expect(createLanguage(WORKSPACE_ID, { code: "de", alias: null })).resolves.toEqual(LANGUAGE);
    expect(sentBody()).toEqual({ code: "de", alias: null });
  });

  test("updates a language's alias by its id", async () => {
    routeFetch({
      [`PATCH /api/internal/languages/${LANGUAGE_ID}`]: [json({ data: { ...LANGUAGE, alias: "german" } })],
    });

    await expect(updateLanguage(LANGUAGE_ID, { alias: "german" })).resolves.toMatchObject({
      alias: "german",
    });
    expect(sentBody()).toEqual({ alias: "german" });
  });

  test("deletes a language by its id", async () => {
    routeFetch({ [`DELETE /api/internal/languages/${LANGUAGE_ID}`]: [json(null, 204)] });

    await expect(deleteLanguage(LANGUAGE_ID)).resolves.toBeUndefined();
  });

  test("a language still in use throws the server's message, which the page shows", async () => {
    const detail =
      "This language is still used by Onboarding. Remove the language from those surveys before deleting it.";
    routeFetch({
      [`DELETE /api/internal/languages/${LANGUAGE_ID}`]: [
        json({ status: 409, detail, code: "conflict" }, 409),
      ],
    });

    const error = await deleteLanguage(LANGUAGE_ID).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(V3ApiError);
    expect(getV3ApiErrorMessage(error, "fallback")).toBe(detail);
  });

  test("lists the surveys using a language", async () => {
    routeFetch({
      [`GET /api/internal/languages/${LANGUAGE_ID}/surveys`]: [json({ data: [{ name: "Onboarding" }] })],
    });

    await expect(listLanguageSurveys(LANGUAGE_ID)).resolves.toEqual([{ name: "Onboarding" }]);
  });
});

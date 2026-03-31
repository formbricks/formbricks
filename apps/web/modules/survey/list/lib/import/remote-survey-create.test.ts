import { createId } from "@paralleldrive/cuid2";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ValidationError } from "@formbricks/types/errors";
import { type TSurveyExportPayload } from "../export-survey";
import { createRemoteSurveyFromPayload } from "./remote-survey-create";

vi.mock("@/lib/env", () => ({
  env: {
    SURVEY_IMPORT_TARGET_HOST: "https://remote.example.com",
    SURVEY_IMPORT_TARGET_ENVIRONMENT_ID: "env_remote",
    SURVEY_IMPORT_TARGET_API_KEY: "api_key_remote",
  },
}));

const buildPayload = (
  languages: Array<{ code: string; enabled: boolean; default: boolean }>
): TSurveyExportPayload => ({
  version: "1.0.0",
  exportDate: new Date().toISOString(),
  data: {
    name: "Imported Survey",
    type: "link",
    questions: [],
    blocks: [
      {
        id: createId(),
        name: "Question 1",
        elements: [
          {
            id: "q_1",
            type: "openText",
            inputType: "text",
            charLimit: { enabled: false },
            required: true,
            headline: { default: "How are you?" },
          },
        ],
      },
    ],
    endings: [
      {
        id: createId(),
        type: "endScreen",
        headline: { default: "Thank you!" },
      },
    ],
    welcomeCard: {
      enabled: true,
      headline: { default: "Welcome" },
      timeToFinish: true,
      showResponseCount: false,
    },
    triggers: [],
    languages,
    followUps: [],
  },
});

describe("createRemoteSurveyFromPayload", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("creates remote survey for multilingual payload and forwards language codes", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "survey_remote_multilingual" } }),
    } as Response);

    await createRemoteSurveyFromPayload(
      buildPayload([
        { code: "en", enabled: true, default: true },
        { code: "de", enabled: true, default: false },
      ]),
      "Imported Survey"
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const request = fetchSpy.mock.calls[0];
    const requestBody = JSON.parse((request?.[1]?.body as string) ?? "{}") as {
      languages?: Array<{ code: string; enabled: boolean; default: boolean }>;
    };
    expect(requestBody.languages).toEqual([
      { code: "en", enabled: true, default: true },
      { code: "de", enabled: true, default: false },
    ]);
  });

  test("creates remote survey for mono-language payload", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "survey_remote_1" } }),
    } as Response);

    const result = await createRemoteSurveyFromPayload(
      buildPayload([{ code: "en", enabled: true, default: true }]),
      "Imported Survey"
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      surveyId: "survey_remote_1",
      surveyUrl: "https://remote.example.com/environments/env_remote/surveys/survey_remote_1/edit",
    });
    const request = fetchSpy.mock.calls[0];
    const requestBody = JSON.parse((request?.[1]?.body as string) ?? "{}") as {
      languages?: unknown;
    };
    expect(requestBody.languages).toBeUndefined();
  });

  test("surfaces remote validation details in thrown error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        code: "bad_request",
        message: "Fields are missing or incorrectly formatted",
        details: {
          "languages.1.code": "Invalid input",
          "languages.1.default": "Expected boolean",
        },
      }),
    } as Response);

    await expect(
      createRemoteSurveyFromPayload(
        buildPayload([
          { code: "en", enabled: true, default: true },
          { code: "de", enabled: true, default: false },
        ]),
        "Imported Survey"
      )
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      createRemoteSurveyFromPayload(
        buildPayload([
          { code: "en", enabled: true, default: true },
          { code: "de", enabled: true, default: false },
        ]),
        "Imported Survey"
      )
    ).rejects.toThrow(
      "Fields are missing or incorrectly formatted\nlanguages.1.code: Invalid input\nlanguages.1.default: Expected boolean"
    );
  });

  test("surfaces compatibility hint for older remote language schema", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        code: "bad_request",
        message: "Fields are missing or incorrectly formatted",
        details: {
          "languages.0.language": "Invalid input: expected object, received undefined",
          "languages.1.language": "Invalid input: expected object, received undefined",
        },
      }),
    } as Response);

    await expect(
      createRemoteSurveyFromPayload(
        buildPayload([
          { code: "en", enabled: true, default: true },
          { code: "de", enabled: true, default: false },
        ]),
        "Imported Survey"
      )
    ).rejects.toThrow(
      "Remote target is using an older survey management API that cannot map imported language codes yet."
    );
  });
});

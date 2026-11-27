import { SAVED_SURVEY_ID, buildSavedSurvey } from "./__mocks__/saved-survey.mock";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import type { TSurveyDraft } from "../types/survey";
import {
  SURVEY_SAVE_TIMEOUT_MS,
  createActionClass,
  getEditorWorkspace,
  getWorkspaceLanguages,
  saveSurvey,
  saveSurveyDraft,
  searchUnsplashPhotos,
  triggerUnsplashPhotoDownload,
} from "./api-client";

const WORKSPACE_ID = "clwork1111111111111111111";
const ISO = "2026-10-01T10:00:00.000Z";
const DATE = new Date(ISO);

const sentBody = () => JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]?.body as string);

describe("survey editor API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("creates an action in the workspace named in the query and revives its timestamps", async () => {
    routeFetch({
      [`POST /api/internal/action-classes?workspaceId=${WORKSPACE_ID}`]: [
        json({ data: { id: "clact1", name: "Signed up", createdAt: ISO, updatedAt: ISO } }, 201),
      ],
    });
    const body = {
      name: "Signed up",
      description: null,
      type: "code" as const,
      key: "signed-up",
      workspaceId: WORKSPACE_ID,
    };

    await expect(createActionClass(WORKSPACE_ID, body)).resolves.toMatchObject({
      id: "clact1",
      createdAt: DATE,
      updatedAt: DATE,
    });
    // The workspace travels in the query; the body refuses unknown keys, so the form's copy is dropped.
    const { workspaceId: _workspaceId, ...withoutWorkspace } = body;
    expect(sentBody()).toEqual(withoutWorkspace);
  });

  test("surfaces a refused create as a V3ApiError carrying the server's message", async () => {
    routeFetch({
      [`POST /api/internal/action-classes?workspaceId=${WORKSPACE_ID}`]: [
        json({ status: 409, detail: "Action with name Signed up already exists" }, 409),
      ],
    });

    await expect(
      createActionClass(WORKSPACE_ID, {
        name: "Signed up",
        description: null,
        type: "code",
        key: "signed-up",
        workspaceId: WORKSPACE_ID,
      })
    ).rejects.toMatchObject({ status: 409, detail: "Action with name Signed up already exists" });
  });

  test("searches Unsplash by query and page", async () => {
    const photo = {
      id: "p1",
      alt_description: "a",
      urls: { regularWithAttribution: "https://x", download: "d" },
    };
    routeFetch({ ["GET /api/internal/unsplash-photos?query=red+fox&page=2"]: [json({ data: [photo] })] });

    await expect(searchUnsplashPhotos("red fox", 2)).resolves.toEqual([photo]);
  });

  test("reports a picked photo, and a refusal is an error the caller can ignore", async () => {
    routeFetch({
      ["POST /api/internal/unsplash-photos/downloads"]: [
        new Response(null, { status: 204 }),
        json({ status: 400, detail: "Invalid request body" }, 400),
      ],
    });

    await expect(triggerUnsplashPhotoDownload("https://api.unsplash.com/photos/x/download")).resolves.toBe(
      undefined
    );
    expect(sentBody()).toEqual({ downloadUrl: "https://api.unsplash.com/photos/x/download" });
    await expect(triggerUnsplashPhotoDownload("https://evil.example")).rejects.toBeInstanceOf(V3ApiError);
  });

  test("saves the survey to its route and revives every date in the answer", async () => {
    const survey = buildSavedSurvey();
    const answer = JSON.parse(JSON.stringify({ ...survey, isSecondPublish: true }));
    routeFetch({ [`PUT /api/internal/surveys/${SAVED_SURVEY_ID}`]: [json({ data: answer })] });

    const saved = await saveSurvey(survey);

    expect(saved.isSecondPublish).toBe(true);
    expect(saved.updatedAt).toEqual(survey.updatedAt);
    expect(saved.publishOn).toEqual(survey.publishOn);
    expect(saved.segment?.createdAt).toEqual(survey.segment?.createdAt);
    expect(saved.followUps[0].createdAt).toBeInstanceOf(Date);
    // The dates go out as ISO strings, which the route revives.
    expect(sentBody()).toMatchObject({ id: SAVED_SURVEY_ID, publishOn: survey.publishOn?.toISOString() });
  });

  test("saves a draft to the draft route and revives its dates", async () => {
    const survey = buildSavedSurvey();
    routeFetch({
      [`PUT /api/internal/surveys/${SAVED_SURVEY_ID}/draft`]: [
        json({ data: JSON.parse(JSON.stringify(survey)) }),
      ],
    });

    const saved = await saveSurveyDraft(survey as unknown as TSurveyDraft);

    expect(saved.createdAt).toEqual(survey.createdAt);
    expect(saved.languages[0].language.updatedAt).toEqual(survey.languages[0].language.updatedAt);
  });

  test("gives a save longer than the write can take, past the shared 15 s mutation timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    routeFetch({
      [`PUT /api/internal/surveys/${SAVED_SURVEY_ID}`]: [json({ data: {} })],
      [`PUT /api/internal/surveys/${SAVED_SURVEY_ID}/draft`]: [json({ data: {} })],
    });

    await saveSurvey(buildSavedSurvey());
    await saveSurveyDraft(buildSavedSurvey() as unknown as TSurveyDraft);

    // The service waits up to 10 s for its transaction and holds it for up to 20 s.
    expect(SURVEY_SAVE_TIMEOUT_MS).toBeGreaterThan(30_000);
    expect(timeout.mock.calls).toEqual([[SURVEY_SAVE_TIMEOUT_MS], [SURVEY_SAVE_TIMEOUT_MS]]);
    timeout.mockRestore();
  });

  test("surfaces a refused save as a V3ApiError carrying the server's message", async () => {
    routeFetch({
      [`PUT /api/internal/surveys/${SAVED_SURVEY_ID}`]: [
        json({ status: 403, detail: "Spam protection is not enabled for this organization" }, 403),
      ],
    });

    await expect(saveSurvey(buildSavedSurvey())).rejects.toMatchObject({
      status: 403,
      detail: "Spam protection is not enabled for this organization",
    });
  });

  test("reads the editor's workspace and revives its timestamps", async () => {
    routeFetch({
      [`GET /api/internal/workspaces/${WORKSPACE_ID}`]: [
        json({ data: { id: WORKSPACE_ID, name: "Website", createdAt: ISO, updatedAt: ISO } }),
      ],
    });

    await expect(getEditorWorkspace(WORKSPACE_ID)).resolves.toEqual({
      id: WORKSPACE_ID,
      name: "Website",
      createdAt: DATE,
      updatedAt: DATE,
    });
  });

  test("reads the workspace's languages with their workspace and dates, as the editor holds them", async () => {
    routeFetch({
      [`GET /api/internal/languages?workspaceId=${WORKSPACE_ID}`]: [
        json({ data: [{ id: "cllang1", code: "de", alias: null, createdAt: ISO, updatedAt: ISO }] }),
      ],
    });

    await expect(getWorkspaceLanguages(WORKSPACE_ID)).resolves.toEqual([
      { id: "cllang1", code: "de", alias: null, createdAt: DATE, updatedAt: DATE, workspaceId: WORKSPACE_ID },
    ]);
  });
});

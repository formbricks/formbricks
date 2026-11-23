import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import {
  attachSurveySegment,
  copySegment,
  createSegment,
  deleteSegment,
  getContactAttributeKeyValues,
  listSegmentFilterSurveys,
  resetSurveySegment,
  updateSegment,
} from "./api-client";

const SEGMENT_ID = "clsegment1111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const KEY_ID = "clkey11111111111111111111";
const ISO = "2026-10-01T10:00:00.000Z";

const resource = {
  id: SEGMENT_ID,
  createdAt: ISO,
  updatedAt: ISO,
  title: "Power users",
  description: null,
  isPrivate: false,
  filters: [],
  workspaceId: WORKSPACE_ID,
  surveys: [SURVEY_ID],
};
const segment = { ...resource, createdAt: new Date(ISO), updatedAt: new Date(ISO) };

const sentBody = () => JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));

describe("segments API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("POSTs a segment, leaving out an empty survey id, and answers it with dates", async () => {
    routeFetch({ "POST /api/internal/segments": [json({ data: resource }, 201)] });

    expect(
      await createSegment({
        workspaceId: WORKSPACE_ID,
        title: "Power users",
        description: "",
        isPrivate: false,
        filters: [],
        surveyId: "",
      })
    ).toEqual(segment);
    expect(sentBody()).toEqual({
      workspaceId: WORKSPACE_ID,
      title: "Power users",
      description: "",
      isPrivate: false,
      filters: [],
    });
  });

  test("sends the survey a segment is created for", async () => {
    routeFetch({ "POST /api/internal/segments": [json({ data: resource }, 201)] });

    await createSegment({
      workspaceId: WORKSPACE_ID,
      title: SURVEY_ID,
      isPrivate: true,
      filters: [],
      surveyId: SURVEY_ID,
    });
    expect(sentBody()).toMatchObject({ surveyId: SURVEY_ID });
  });

  test("PATCHes only the fields a segment update takes, even from a whole segment", async () => {
    routeFetch({ [`PATCH /api/internal/segments/${SEGMENT_ID}`]: [json({ data: resource })] });

    expect(await updateSegment(SEGMENT_ID, { ...segment, title: "Renamed" })).toEqual(segment);
    expect(sentBody()).toEqual({
      title: "Renamed",
      description: null,
      isPrivate: false,
      filters: [],
      surveys: [SURVEY_ID],
    });
  });

  test("DELETEs a segment", async () => {
    routeFetch({ [`DELETE /api/internal/segments/${SEGMENT_ID}`]: [new Response(null, { status: 204 })] });
    await expect(deleteSegment(SEGMENT_ID)).resolves.toBeUndefined();
  });

  test("POSTs a copy onto a survey", async () => {
    routeFetch({ [`POST /api/internal/segments/${SEGMENT_ID}/copies`]: [json({ data: resource }, 201)] });

    expect(await copySegment(SEGMENT_ID, SURVEY_ID)).toEqual(segment);
    expect(sentBody()).toEqual({ surveyId: SURVEY_ID });
  });

  test("PUTs a survey's segment and answers the segment it targets", async () => {
    routeFetch({
      [`PUT /api/internal/surveys/${SURVEY_ID}/segment`]: [
        json({ data: { surveyId: SURVEY_ID, segment: resource } }),
      ],
    });

    expect(await attachSurveySegment(SURVEY_ID, SEGMENT_ID)).toEqual(segment);
    expect(sentBody()).toEqual({ segmentId: SEGMENT_ID });
  });

  test("POSTs a reset of a survey's segment", async () => {
    routeFetch({
      [`POST /api/internal/surveys/${SURVEY_ID}/segment/resets`]: [
        json({ data: { surveyId: SURVEY_ID, segment: resource } }),
      ],
    });

    expect(await resetSurveySegment(SURVEY_ID)).toEqual(segment);
  });

  test("reads an attribute's values and the surveys a filter can name", async () => {
    routeFetch({
      [`GET /api/internal/contact-attribute-keys/${KEY_ID}/values`]: [json({ data: ["free", "pro"] })],
      [`GET /api/internal/workspaces/${WORKSPACE_ID}/segment-filter-surveys`]: [
        json({ data: [{ id: SURVEY_ID, name: "Onboarding", status: "inProgress" }] }),
      ],
    });

    expect(await getContactAttributeKeyValues(KEY_ID)).toEqual(["free", "pro"]);
    expect(await listSegmentFilterSurveys(WORKSPACE_ID)).toEqual([
      { id: SURVEY_ID, name: "Onboarding", status: "inProgress" },
    ]);
  });

  test("surfaces a segment still in use as the server's message", async () => {
    const detail = "Cannot delete a segment that is associated with a survey";
    routeFetch({ [`DELETE /api/internal/segments/${SEGMENT_ID}`]: [json({ status: 409, detail }, 409)] });

    const error = await deleteSegment(SEGMENT_ID).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(V3ApiError);
    expect((error as V3ApiError).message).toBe(detail);
  });
});

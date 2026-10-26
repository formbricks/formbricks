import { afterEach, describe, expect, test, vi } from "vitest";
import { type TSurveyLinkedCreative, getCreativesToKeepPaused, planSurveyStatusChange } from "./survey-side";
import { MAX_LINKED_CREATIVE_PAGES, listSurveyLinkedCreatives } from "./survey-side-api";

/** A creative paused with its survey: the ones a resume brings back, unless kept paused. */
const pausedWithSurvey = (index: number): TSurveyLinkedCreative => ({
  id: `creative-${index}`,
  name: `Creative ${index}`,
  status: "inProgress",
  displayStatus: "paused",
  displayStatusReason: "surveyNotActive",
  archivedAt: null,
  schedule: { startAt: null, endAt: null },
});

/** `GET /api/v3/creatives?surveyId=` as the API pages it: `limit` a page, a cursor while more follow. */
const serveLinkedCreatives = (total: number, { endless = false } = {}) => {
  const creatives = Array.from({ length: total }, (_, index) => pausedWithSurvey(index));
  const fetchMock = vi.fn(async (url: string) => {
    const params = new URL(url, "http://localhost").searchParams;
    const start = Number(params.get("cursor") ?? 0);
    const limit = Number(params.get("limit"));
    const end = start + limit;
    const nextCursor = endless || end < total ? String(end) : null;
    return Response.json({ data: creatives.slice(start, end), meta: { limit, nextCursor } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSurveyLinkedCreatives", () => {
  test("reads every page, so a resume that keeps them paused pauses all 251", async () => {
    const fetchMock = serveLinkedCreatives(251);

    const creatives = await listSurveyLinkedCreatives({ workspaceId: "ws", surveyId: "sv" });
    const plan = planSurveyStatusChange({ from: "paused", to: "inProgress", creatives, now: new Date() });

    expect(creatives).toHaveLength(251);
    expect(getCreativesToKeepPaused(plan!, true)).toHaveLength(251);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test("fails, rather than return some of them, for a survey opened by more than its ceiling", async () => {
    const fetchMock = serveLinkedCreatives(1, { endless: true });

    await expect(listSurveyLinkedCreatives({ workspaceId: "ws", surveyId: "sv" })).rejects.toThrow(
      "Survey sv is opened by more than"
    );
    expect(fetchMock).toHaveBeenCalledTimes(MAX_LINKED_CREATIVE_PAGES);
  });
});

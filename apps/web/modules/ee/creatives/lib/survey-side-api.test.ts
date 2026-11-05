import { afterEach, describe, expect, test, vi } from "vitest";
import type { TSurveyLinkedCreative } from "./survey-side";
import {
  MAX_LINKED_CREATIVE_PAGES,
  listSurveyLinkedCreatives,
  pauseSurveyCreatives,
} from "./survey-side-api";

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
  test("reads every page, so a status change names all 251", async () => {
    const fetchMock = serveLinkedCreatives(251);

    const creatives = await listSurveyLinkedCreatives({ workspaceId: "ws", surveyId: "sv" });

    expect(creatives).toHaveLength(251);
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

describe("pauseSurveyCreatives", () => {
  test("keeps every creative of the survey paused with one request, however many there are", async () => {
    const fetchMock = vi.fn(async () => Response.json({ data: { paused: 251, creativeIds: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    await pauseSurveyCreatives({ workspaceId: "ws", surveyId: "sv" });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v3/creatives/pause",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ workspaceId: "ws", surveyId: "sv" }) })
    );
  });

  test("rejects when the server refuses, so the survey is not resumed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { title: "Forbidden", status: 403, code: "forbidden", detail: "Not allowed" },
          { status: 403, headers: { "Content-Type": "application/problem+json" } }
        )
      )
    );

    await expect(pauseSurveyCreatives({ workspaceId: "ws", surveyId: "sv" })).rejects.toThrow();
  });
});

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { getActionClassSurveys, getLatestRelease, updateActionClass } from "./api-client";

const fetchMock = vi.fn();
const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("app connection API client", () => {
  // The survey editor puts the updated action back into the survey's triggers, which are saved with the
  // survey; JSON's strings there would not be the Dates the survey schema holds.
  test("revives an updated action's timestamps to Dates", async () => {
    fetchMock.mockResolvedValue(
      json({
        data: {
          id: "act-1",
          name: "Clicked",
          createdAt: "2026-10-01T10:00:00.000Z",
          updatedAt: "2026-10-02T10:00:00.000Z",
        },
      })
    );

    const updated = await updateActionClass("act-1", {
      name: "Clicked",
      description: null,
      type: "code",
      key: "clicked",
      workspaceId: "ws-1",
    } as never);

    expect(updated.createdAt).toEqual(new Date("2026-10-01T10:00:00.000Z"));
    expect(updated.updatedAt).toEqual(new Date("2026-10-02T10:00:00.000Z"));
    expect(fetchMock.mock.calls[0][0]).toBe("/api/internal/action-classes/act-1");
    expect(fetchMock.mock.calls[0][1].method).toBe("PATCH");
  });

  test("asks for an action's surveys without the one being edited", async () => {
    fetchMock.mockResolvedValue(json({ data: { activeSurveys: [], inactiveSurveys: [] } }));

    await getActionClassSurveys("act-1", "survey-1");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "/api/internal/action-classes/act-1/surveys?excludeSurveyId=survey-1"
    );
  });

  test("reads the latest release tag, forwarding the abort signal", async () => {
    fetchMock.mockResolvedValue(json({ data: { tag: "v6.1.0" } }));
    const controller = new AbortController();

    await expect(getLatestRelease({ signal: controller.signal })).resolves.toBe("v6.1.0");
    expect(fetchMock.mock.calls[0][1].signal).toBe(controller.signal);
  });
});

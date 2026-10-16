import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { isAppSurveyBlockedFromPublishing } from "./survey-publish";

vi.mock("server-only", () => ({}));

vi.mock("@formbricks/database", () => ({
  prisma: { creative: { findFirst: vi.fn() } },
}));

const appSurvey = { surveyId: "survey-1", type: "app", status: "inProgress" } as const;

describe("isAppSurveyBlockedFromPublishing", () => {
  beforeEach(() => {
    vi.mocked(prisma.creative.findFirst).mockReset();
  });

  test("publishes an app survey with no trigger while a non-archived creative opens it", async () => {
    vi.mocked(prisma.creative.findFirst).mockResolvedValue({ id: "creative-1" } as never);

    expect(await isAppSurveyBlockedFromPublishing({ ...appSurvey, triggers: [] })).toBe(false);
    expect(prisma.creative.findFirst).toHaveBeenCalledWith({
      where: { surveyId: "survey-1", archivedAt: null },
      select: { id: true },
    });
  });

  test("refuses an app survey with no trigger and no creative that opens it", async () => {
    vi.mocked(prisma.creative.findFirst).mockResolvedValue(null);

    expect(await isAppSurveyBlockedFromPublishing({ ...appSurvey, triggers: [] })).toBe(true);
  });

  test("looks no creative up when the survey can publish on its own", async () => {
    expect(
      await isAppSurveyBlockedFromPublishing({ ...appSurvey, triggers: [{ actionClass: { name: "Click" } }] })
    ).toBe(false);
    expect(await isAppSurveyBlockedFromPublishing({ ...appSurvey, status: "draft", triggers: [] })).toBe(
      false
    );
    expect(await isAppSurveyBlockedFromPublishing({ ...appSurvey, type: "link", triggers: [] })).toBe(false);
    expect(prisma.creative.findFirst).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { env } from "@/lib/env";
import {
  SURVEY_VISIBILITY_READINESS_MEMO_TTL_MS,
  clearProjectionScopeReady,
  isSurveyVisibilityReady,
  resetSurveyVisibilityReadinessMemo,
  setProjectionScopeReady,
} from "./scope-readiness";

vi.mock("@formbricks/database", () => ({
  prisma: { authzedProjectionScopeState: { findUnique: vi.fn(), upsert: vi.fn() } },
}));
vi.mock("@/lib/env", () => ({ env: { SURVEY_VISIBILITY_FORCE_DISABLED: undefined } }));

const findUnique = vi.mocked(prisma.authzedProjectionScopeState.findUnique);

describe("isSurveyVisibilityReady", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetSurveyVisibilityReadinessMemo();
    (env as { SURVEY_VISIBILITY_FORCE_DISABLED?: string }).SURVEY_VISIBILITY_FORCE_DISABLED = undefined;
  });

  test("is ready only when the survey row carries a readyAt", async () => {
    findUnique.mockResolvedValueOnce({ readyAt: new Date() } as never);
    await expect(isSurveyVisibilityReady()).resolves.toBe(true);

    resetSurveyVisibilityReadinessMemo();
    findUnique.mockResolvedValueOnce({ readyAt: null } as never);
    await expect(isSurveyVisibilityReady()).resolves.toBe(false);

    resetSurveyVisibilityReadinessMemo();
    findUnique.mockResolvedValueOnce(null);
    await expect(isSurveyVisibilityReady()).resolves.toBe(false);
  });

  test("shares one read across concurrent checks and reuses it within the TTL", async () => {
    findUnique.mockResolvedValue({ readyAt: new Date() } as never);

    await Promise.all([isSurveyVisibilityReady(), isSurveyVisibilityReady(), isSurveyVisibilityReady()]);
    await isSurveyVisibilityReady();

    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  test("reads again once the TTL has passed", async () => {
    const now = vi.spyOn(performance, "now").mockReturnValue(1_000);
    findUnique.mockResolvedValue({ readyAt: new Date() } as never);

    await isSurveyVisibilityReady();
    now.mockReturnValue(1_000 + SURVEY_VISIBILITY_READINESS_MEMO_TTL_MS + 1);
    await isSurveyVisibilityReady();

    expect(findUnique).toHaveBeenCalledTimes(2);
    now.mockRestore();
  });

  test("fails closed on a failed read, without caching the failure", async () => {
    findUnique.mockRejectedValueOnce(new Error("connection reset"));
    await expect(isSurveyVisibilityReady()).resolves.toBe(false);

    findUnique.mockResolvedValueOnce({ readyAt: new Date() } as never);
    await expect(isSurveyVisibilityReady()).resolves.toBe(true);
  });

  test("the emergency override wins without reading the database", async () => {
    (env as { SURVEY_VISIBILITY_FORCE_DISABLED?: string }).SURVEY_VISIBILITY_FORCE_DISABLED = "1";
    findUnique.mockResolvedValue({ readyAt: new Date() } as never);

    await expect(isSurveyVisibilityReady()).resolves.toBe(false);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("readiness marker writes", () => {
  test("set stamps readyAt and readyBy; clear nulls both, creating the row if needed", async () => {
    await setProjectionScopeReady("survey", "operator");
    await clearProjectionScopeReady("survey");

    const [set, clear] = vi
      .mocked(prisma.authzedProjectionScopeState.upsert)
      .mock.calls.map(([args]) => args);
    expect(set).toMatchObject({
      create: { readyAt: expect.any(Date), readyBy: "operator", scope: "survey" },
      where: { scope: "survey" },
    });
    expect(clear).toEqual({
      create: { readyAt: null, readyBy: null, scope: "survey" },
      update: { readyAt: null, readyBy: null },
      where: { scope: "survey" },
    });
  });
});

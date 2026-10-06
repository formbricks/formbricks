import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { env } from "@/lib/env";
import {
  DEFAULT_SURVEY_WORKSPACE_LIMIT,
  WorkspaceSurveyLimitError,
  assertWorkspaceSurveyLimit,
} from "./limit";

vi.mock("@formbricks/database", () => ({ prisma: { survey: { count: vi.fn() } } }));
vi.mock("@/lib/env", () => ({ env: { SURVEY_WORKSPACE_LIMIT: undefined } }));

const setLimit = (limit: number | undefined): void => {
  (env as { SURVEY_WORKSPACE_LIMIT?: number }).SURVEY_WORKSPACE_LIMIT = limit;
};

describe("assertWorkspaceSurveyLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLimit(undefined);
  });

  test("admits the last survey below the cap and refuses the one at it", async () => {
    setLimit(3);
    vi.mocked(prisma.survey.count).mockResolvedValueOnce(2);
    await expect(assertWorkspaceSurveyLimit("ws-1")).resolves.toBeUndefined();

    vi.mocked(prisma.survey.count).mockResolvedValueOnce(3);
    const error = await assertWorkspaceSurveyLimit("ws-1").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(WorkspaceSurveyLimitError);
    expect(error).toMatchObject({ count: 3, limit: 3 });
    // Archived surveys count too: the query is not filtered by status or archivedAt.
    expect(prisma.survey.count).toHaveBeenLastCalledWith({ where: { workspaceId: "ws-1" } });
  });

  test("defaults to 10,000", async () => {
    vi.mocked(prisma.survey.count).mockResolvedValueOnce(DEFAULT_SURVEY_WORKSPACE_LIMIT);

    await expect(assertWorkspaceSurveyLimit("ws-1")).rejects.toMatchObject({ limit: 10_000 });
  });
});

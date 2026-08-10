import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { getIssuedAuthorizationCheckCount, withAuthorizationSurface } from "@/lib/authorization/context";
import { getResponseDownloadFile } from "@/lib/response/service";
import { checkAuthorizationUpdated } from "@/lib/utils/action-client/action-client-middleware";
import { getOrganizationIdFromSurveyId, getWorkspaceIdFromSurveyId } from "@/lib/utils/helper";

/**
 * ENG-1739 follow-up: the response-heavy export path the ticket names by name ("response-heavy
 * analytics/export paths"). This drives the exact call sequence `getResponsesDownloadUrlAction` makes
 * — one `checkAuthorizationUpdated`, then `getResponseDownloadFile` — rather than the action wrapper
 * itself, which needs a `next-safe-action` context this test has no reason to construct.
 *
 * `getResponseDownloadFile` paginates internally in batches of 3,000 (`lib/response/service.ts`) to
 * avoid one unbounded query; that loop fetches rows, it does not authorize per batch. The batch sizes
 * below (1 and 6,500 — comfortably past two full batches) exist to prove that pagination loop is not
 * hiding a second authorization check.
 *
 * The expected count is NOT 1. `checkAuthorizationUpdated` itself makes two `can()` calls for this
 * access shape — one `organization.read` membership gate, then one for the first matching access item
 * (`organization.manage`, since the seeded user is an owner) — before `getResponseDownloadFile` runs.
 * That is `checkAuthorizationUpdated`'s own fixed cost, unrelated to response count, and asserting a
 * literal here would fail for the wrong reason if that adapter's internals ever change. The claim
 * under test is narrower and is what actually matters: whichever constant it is, it does not grow
 * with the number of responses exported.
 */
const scenario: { organizationId: string; surveyId: string; userId: string; workspaceId: string } = {
  organizationId: "",
  surveyId: "",
  userId: "",
  workspaceId: "",
};

const RESPONSE_COUNTS = [1, 6_500] as const;

beforeAll(async () => {
  await resetDb();

  const organization = await prisma.organization.create({ data: { name: "Export Checks Org" } });
  const user = await prisma.user.create({ data: { name: "owner", email: "owner@export-checks.test" } });
  await prisma.membership.create({
    data: { userId: user.id, organizationId: organization.id, role: "owner", accepted: true },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "Export Checks Workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "Export Checks Survey", workspaceId: workspace.id, status: "inProgress", type: "link" },
  });

  scenario.organizationId = organization.id;
  scenario.userId = user.id;
  scenario.workspaceId = workspace.id;
  scenario.surveyId = survey.id;
}, 120_000);

const exportFor = async (
  responseCount: number
): Promise<{ checksIssued: number | null; lineCount: number }> => {
  await prisma.response.deleteMany({ where: { surveyId: scenario.surveyId } });
  await prisma.response.createMany({
    data: Array.from({ length: responseCount }, () => ({
      surveyId: scenario.surveyId,
      finished: true,
      data: {},
      meta: {},
    })),
  });

  return withAuthorizationSurface("server_action", async () => {
    // The exact sequence `getResponsesDownloadUrlAction` runs.
    await checkAuthorizationUpdated({
      userId: scenario.userId,
      organizationId: await getOrganizationIdFromSurveyId(scenario.surveyId),
      access: [
        { type: "organization", roles: ["owner", "manager"] },
        {
          type: "workspaceTeam",
          minPermission: "read",
          workspaceId: await getWorkspaceIdFromSurveyId(scenario.surveyId),
        },
      ],
    });

    const file = await getResponseDownloadFile(scenario.surveyId, "csv");
    return {
      checksIssued: getIssuedAuthorizationCheckCount(),
      lineCount: file.fileContents.split("\n").filter(Boolean).length,
    };
  });
};

describe("response export authorization amplification, against a real database", () => {
  test.each(RESPONSE_COUNTS)(
    "exporting a survey's responses issues a response-count-independent number of checks, with %d responses present",
    async (responseCount) => {
      const result = await exportFor(responseCount);

      // The header row plus one line per response, at minimum.
      expect(result.lineCount).toBeGreaterThanOrEqual(responseCount);
      // Not just "not null": a counter that stopped incrementing would read 0 here, which is not
      // null either, so this must be a positive-count assertion or the test cannot fail.
      expect(result.checksIssued).toBeGreaterThan(0);
    }
  );

  test("the check count does not grow between 1 and 6,500 exported responses", async () => {
    // Sequential: both calls reuse and rewrite the same survey's responses.
    const small = await exportFor(1);
    const large = await exportFor(6_500);

    // Asserted separately from the equality below: a counter that never increments would make
    // `large - small` equal 0 vacuously, and the point of this test is that a nonzero constant
    // doesn't grow, not that two zeros match.
    expect(small.checksIssued).toBeGreaterThan(0);
    expect(large.checksIssued! - small.checksIssued!).toBe(0);
  });
});

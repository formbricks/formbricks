import { expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import type { UsersFixture } from "./fixtures/users";
import { test } from "./lib/fixtures";

// ENG-2101 regression: the survey pages authorize the workspaceId in the URL but used to load the
// survey by surveyId alone, so pairing your own workspace with someone else's survey id read their
// survey definition, response counts and response content. Survey ids are public (/s/<surveyId>),
// so this needed nothing but a free account. Every survey-scoped page now goes through
// getSurveyAuth, which ties the two together and fails closed with a 404. The second test guards
// against a fix that over-blocks and takes the owner's own surveys down with it.

// Name of the survey seeded into every workspace by the users fixture.
const SEED_SURVEY_NAME = "E2E Seed Survey";

const getSeededSurveyId = async (workspaceId: string) => {
  const survey = await prisma.survey.findFirstOrThrow({
    where: { workspaceId },
    select: { id: true },
  });
  return survey.id;
};

// Two unrelated tenants: the attacker owns their own org/workspace/survey and has no membership in
// the victim's organization.
const setupTwoTenants = async (users: UsersFixture) => {
  const victim = await users.create();
  const attacker = await users.create();

  if (!victim.workspaceId || !attacker.workspaceId) {
    throw new Error("Workspaces not seeded for test");
  }

  return {
    attacker,
    attackerWorkspaceId: attacker.workspaceId,
    attackerSurveyId: await getSeededSurveyId(attacker.workspaceId),
    victimSurveyId: await getSeededSurveyId(victim.workspaceId),
  };
};

test.describe("Cross-tenant survey access (ENG-2101)", () => {
  test("404s when a foreign survey id is paired with an authorized workspace", async ({ page, users }) => {
    const { attacker, attackerWorkspaceId, victimSurveyId } = await setupTwoTenants(users);

    await attacker.login();

    const base = `/workspaces/${attackerWorkspaceId}/surveys/${victimSurveyId}`;

    for (const url of [base, `${base}/summary`, `${base}/responses`, `${base}/edit`]) {
      await page.goto(url, { waitUntil: "domcontentloaded" });

      await expect(page.getByTestId("error-code"), `${url} must not expose the foreign survey`).toHaveText(
        "404"
      );
      await expect(page.getByText(SEED_SURVEY_NAME)).toHaveCount(0);
      // generateMetadata resolves independently of the page, so a 404 body is not on its own
      // proof the survey name stayed private — it also has to be absent from the title.
      await expect(page, `${url} must not expose the foreign survey in the title`).not.toHaveTitle(
        new RegExp(SEED_SURVEY_NAME)
      );
    }
  });

  test("keeps access to the workspace's own surveys", async ({ page, users }) => {
    const { attacker, attackerWorkspaceId, attackerSurveyId } = await setupTwoTenants(users);

    await attacker.login();

    const base = `/workspaces/${attackerWorkspaceId}/surveys/${attackerSurveyId}`;

    // The bare survey route redirects to the summary.
    await page.goto(base, { waitUntil: "domcontentloaded" });
    await page.waitForURL(`**${base}/summary`);
    await expect(page.getByRole("heading", { name: SEED_SURVEY_NAME })).toBeVisible();

    await page.goto(`${base}/responses`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: SEED_SURVEY_NAME })).toBeVisible();

    await page.goto(`${base}/edit`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  });
});

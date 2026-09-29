import { type Browser, type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { type UsersFixture, login } from "./fixtures/users";
import { test } from "./lib/fixtures";

// ENG-3395: restricted surveys, end to end. This spec needs the survey readiness marker, which is one
// global row: set in the shared job it would make every survey restricted and open the Activate
// dialog in every other spec. So it runs only in its own CI job (`e2e.yml`, `survey-visibility`),
// against a database where `authzed:backfill --scope=survey --mark-ready` has run, and the main
// Playwright project ignores it (`playwright.config.ts`).

const WORKSPACE_NAME = "Visibility Journey";
const VISIBLE_TO_WORKSPACE = `Visible to ${WORKSPACE_NAME}`;
// The authorization projection runs behind an outbox, so a grant or revocation reaches another
// viewer's list a moment after the owner's request returns. Waited for as state, never as time.
const PROJECTION_BUDGET_MS = 60_000;

const surveyRow = (page: Page, surveyName: string): Locator =>
  page.locator("div.relative.block", { has: page.getByText(surveyName, { exact: true }) });

// A second member of the owner's organization who reaches the workspace through a readWrite team
// grant — the role that sees every workspace-visible survey and no restricted one (setup as in
// billing-role-access.spec.ts).
const addTeamMember = async (users: UsersFixture, organizationId: string, workspaceId: string) => {
  const member = await users.create({ withoutWorkspace: true });
  await prisma.membership.create({
    data: { userId: member.id, organizationId, role: "member", accepted: true },
  });
  await prisma.team.create({
    data: {
      name: `Visibility journey team ${Date.now()}`,
      organizationId,
      teamUsers: { create: { userId: member.id, role: "contributor" } },
      workspaceTeams: { create: { workspaceId, permission: "readWrite" } },
    },
  });
  return prisma.user.findUniqueOrThrow({ where: { id: member.id }, include: { memberships: true } });
};

const openMemberPage = async (
  browser: Browser,
  baseURL: string | undefined,
  member: Awaited<ReturnType<typeof addTeamMember>>
) => {
  // Its own context: the owner's session cookie must not leak into the member's requests.
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await login(member, page);
  return page;
};

// Signed-in creation is where the restricted default is decided, so the survey is created through the
// same v3 endpoint the editor's "Create survey" calls, with the owner's session.
const createSurveyAsOwner = async (page: Page, workspaceId: string, name: string): Promise<string> => {
  const response = await page.context().request.post("/api/v3/surveys", {
    data: {
      workspaceId,
      name,
      status: "draft",
      defaultLanguage: "en-US",
      blocks: [
        {
          name: "Main Block",
          elements: [
            {
              id: "improve",
              type: "openText",
              headline: { "en-US": "What should we improve?" },
              required: false,
            },
          ],
        },
      ],
      endings: [],
    },
  });
  const body = (await response.json().catch(() => null)) as { data?: { id?: string } } | null;
  expect(response.status(), JSON.stringify(body)).toBe(201);
  if (typeof body?.data?.id !== "string") throw new TypeError("Survey create response carried no id");
  return body.data.id;
};

test.describe("Restricted surveys", () => {
  test("a restricted survey stays with its owner until it is made visible to the workspace", async ({
    page,
    users,
    browser,
    baseURL,
  }) => {
    const surveyName = `Restricted journey ${Date.now()}`;
    // `users.create` also seeds "E2E Seed Survey" straight through Prisma, which is workspace-visible
    // by column default: it is the member's proof of access to the list, so an empty list can never
    // pass for "the restricted survey is hidden".
    const owner = await users.create({ workspaceName: WORKSPACE_NAME });
    if (!owner.organizationId || !owner.workspaceId) throw new Error("Owner workspace was not seeded");
    const { organizationId, workspaceId } = owner;
    const surveysUrl = `/workspaces/${workspaceId}/surveys`;

    await owner.login();
    const surveyId = await createSurveyAsOwner(page, workspaceId, surveyName);
    const member = await addTeamMember(users, organizationId, workspaceId);
    const memberPage = await openMemberPage(browser, baseURL, member);

    await test.step("the owner's new survey starts restricted, unmarked, with Collaborate in its menu", async () => {
      await page.goto(surveysUrl);
      const row = surveyRow(page, surveyName);
      await expect(row).toBeVisible();
      await expect(row.getByRole("link")).not.toHaveAccessibleName(new RegExp(VISIBLE_TO_WORKSPACE));
      // The seeded survey is workspace-visible, so the same list does carry the marker elsewhere.
      await expect(surveyRow(page, "E2E Seed Survey").getByRole("link")).toHaveAccessibleName(
        new RegExp(VISIBLE_TO_WORKSPACE)
      );

      await row.getByTestId("survey-dropdown-trigger").click();
      await expect(page.getByRole("menuitem", { name: "Collaborate" })).toBeVisible();
      await page.keyboard.press("Escape");
    });

    await test.step("a team member with write access neither lists nor reads it", async () => {
      await expect(async () => {
        await memberPage.goto(surveysUrl);
        await expect(surveyRow(memberPage, "E2E Seed Survey")).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: PROJECTION_BUDGET_MS });
      await expect(surveyRow(memberPage, surveyName)).toHaveCount(0);

      const status = await memberPage.evaluate(
        async (id) => (await fetch(`/api/v3/surveys/${id}`)).status,
        surveyId
      );
      expect(status).toBe(403);
    });

    await test.step("the owner makes it visible to the workspace without a confirmation", async () => {
      const row = surveyRow(page, surveyName);
      await row.getByTestId("survey-dropdown-trigger").click();
      await page.getByRole("menuitem", { name: "Collaborate" }).click();

      const dialog = page.getByRole("dialog", { name: "Collaborate" });
      await expect(dialog.getByText(surveyName)).toBeVisible();
      const select = dialog.getByLabel("Visibility");
      await expect(select).toBeEnabled();
      await expect(select).toHaveText("Restricted");
      await select.click();
      await page.getByRole("option", { name: new RegExp(`^${VISIBLE_TO_WORKSPACE}`) }).click();
      await dialog.getByRole("button", { name: "Save", exact: true }).click();

      await expect(dialog).toBeHidden();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(row.getByRole("link")).toHaveAccessibleName(new RegExp(VISIBLE_TO_WORKSPACE));
    });

    await test.step("the member now sees it, marked, with the tooltip explaining who can see it", async () => {
      const row = surveyRow(memberPage, surveyName);
      await expect(async () => {
        await memberPage.reload();
        await expect(row).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: PROJECTION_BUDGET_MS });
      await expect(row.getByRole("link")).toHaveAccessibleName(new RegExp(VISIBLE_TO_WORKSPACE));

      // The icon is the first tooltip trigger in the row: it precedes the name.
      await row.locator("span[data-state]").first().hover();
      const tooltip = memberPage.getByRole("tooltip");
      await expect(tooltip).toContainText(VISIBLE_TO_WORKSPACE);
      await expect(tooltip).toContainText(
        `Everyone in ${WORKSPACE_NAME} can see this survey and its responses.`
      );
    });

    await test.step("the owner restricts it again and activates it as restricted", async () => {
      await page.goto(`/workspaces/${workspaceId}/surveys/${surveyId}/edit`);

      // Visible → Restricted always confirms.
      await page.getByRole("button", { name: "Collaborate" }).click();
      const collaborate = page.getByRole("dialog", { name: "Collaborate" });
      const select = collaborate.getByLabel("Visibility");
      await expect(select).toHaveText(VISIBLE_TO_WORKSPACE);
      await select.click();
      await page.getByRole("option", { name: /^Restricted/ }).click();
      await collaborate.getByRole("button", { name: "Save", exact: true }).click();

      const confirm = page.getByRole("dialog", { name: "Change visibility to Restricted?" });
      await expect(confirm).toBeVisible();
      await confirm.getByRole("button", { name: "Change to Restricted" }).click();
      await expect(confirm).toBeHidden();

      // A restricted survey asks who can view it before it goes active; nothing is preselected.
      await page.getByRole("button", { name: "Activate", exact: true }).click();
      const activate = page.getByRole("dialog", { name: "Who can view this survey?" });
      const activateButton = activate.getByRole("button", { name: "Activate", exact: true });
      await expect(activateButton).toBeDisabled();
      await activate.getByRole("radio", { name: /^Restricted/ }).check();
      await Promise.all([
        page.waitForURL(/\/workspaces\/[^/]+\/surveys\/[^/]+\/summary(\?.*)?$/),
        activateButton.click(),
      ]);

      await expect
        .poll(async () =>
          prisma.survey.findUniqueOrThrow({
            where: { id: surveyId },
            select: { status: true, visibility: true },
          })
        )
        .toEqual({ status: "inProgress", visibility: "restricted" });
    });

    await test.step("the member no longer sees it", async () => {
      await expect(async () => {
        await memberPage.reload();
        await expect(surveyRow(memberPage, "E2E Seed Survey")).toBeVisible({ timeout: 5_000 });
        await expect(surveyRow(memberPage, surveyName)).toHaveCount(0, { timeout: 1_000 });
      }).toPass({ timeout: PROJECTION_BUDGET_MS });
    });

    await memberPage.context().close();
  });
});

import { createId } from "@paralleldrive/cuid2";
import { type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TSurveyEnding } from "@formbricks/types/surveys/types";
import { transformQuestionsToBlocks } from "@/app/lib/api/survey-transformation";
import { test } from "./lib/fixtures";

/**
 * **Auto-captured browser context, end to end (ENG-1841).**
 *
 * The unit suites prove each seam on its own: the renderer reads and freezes the runtime
 * (packages/surveys/src/lib/browser-context.test.ts), the schema accepts the fields
 * (packages/types/responses.test.ts), and the ingest routes re-list them through their whitelist
 * (the two client `responses/route.test.ts`). None of that proves the seams are connected — and the
 * failure mode is silent: a response is still created, just without the fields.
 *
 * So this walks the real chain once, on a link survey: browser → `/api/v2/client/.../responses` →
 * Postgres, then reads `response.meta` straight out of the database.
 *
 * A link survey is what a browser test can reach; the app-survey path (v1, chosen by the SDK when
 * the response carries a `userId`) is covered by the v1 route unit test instead.
 */
type I18n = { default: string };
const i18nValue = (value: string): I18n => ({ default: value });

type TLegacyQuestions = Parameters<typeof transformQuestionsToBlocks>[0];

const QUESTION = "How did you hear about us?";
const ENDING_HEADLINE = "Thanks!";

/** The campaign the respondent's link advertises, and which the renderer must read back off it. */
const UTM_QUERY =
  "utm_source=newsletter&utm_medium=email&utm_campaign=august-launch&utm_term=pricing&utm_content=hero-cta";

const seedSurvey = async (workspaceId: string, createdBy: string): Promise<string> => {
  const endings = [
    { id: createId(), type: "endScreen" as const, headline: i18nValue(ENDING_HEADLINE) },
  ] as unknown as TSurveyEnding[];

  const questions = [
    {
      id: createId(),
      type: "openText",
      headline: i18nValue(QUESTION),
      required: true,
      inputType: "text",
      placeholder: i18nValue("Type your answer here..."),
      charLimit: { enabled: false },
    },
  ];

  const survey = await prisma.survey.create({
    data: {
      workspaceId,
      createdBy,
      name: "Auto-captured metadata survey",
      type: "link",
      status: "inProgress",
      welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
      blocks: transformQuestionsToBlocks(
        questions as unknown as TLegacyQuestions,
        endings
      ) as unknown as Prisma.InputJsonValue[],
      endings: endings as unknown as Prisma.InputJsonValue[],
    },
    select: { id: true },
  });

  return survey.id;
};

/** The response row is written asynchronously after submit, so poll rather than race it. */
const readStoredMeta = async (surveyId: string): Promise<Record<string, unknown>> => {
  let meta: Record<string, unknown> | undefined;

  await expect
    .poll(
      async () => {
        const response = await prisma.response.findFirst({
          where: { surveyId },
          orderBy: { createdAt: "desc" },
          select: { meta: true },
        });
        meta = (response?.meta ?? undefined) as Record<string, unknown> | undefined;
        return meta?.pagePath ?? null;
      },
      { timeout: 20000, message: "No response with an auto-captured pagePath was stored" }
    )
    .not.toBeNull();

  return meta ?? {};
};

const submitAnswer = async (page: Page, answer: string): Promise<void> => {
  await expect(page.getByText(QUESTION)).toBeVisible();
  await page.getByPlaceholder("Type your answer here...").fill(answer);
  await page.getByRole("button", { name: "Finish" }).click();
  // The renderer shows "Sending responses…" until the ingest POST resolves, and the ending card only
  // after. The default 5s is not enough for the first submission of a run, so wait for the real
  // signal rather than a fixed sleep.
  await expect(page.getByText(ENDING_HEADLINE)).toBeVisible({ timeout: 60000 });
};

test.describe("Auto-captured browser context on responses @slow", () => {
  let surveyUrl: string | undefined;
  let surveyId: string | undefined;

  test.beforeEach(async ({ users }) => {
    if (surveyUrl) return;
    const user = await users.create({ skipSurveySeed: true });
    if (!user.workspaceId) throw new Error("users.create() did not return a workspaceId");
    surveyId = await seedSurvey(user.workspaceId, user.id);
    surveyUrl = `/s/${surveyId}`;
  });

  test("stores page, UTM, viewport, screen and timezone on the submitted response", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${surveyUrl}?${UTM_QUERY}`);

    await submitAnswer(page, "From the newsletter");

    const meta = await readStoredMeta(surveyId ?? "");

    // The page the respondent answered on. On a link survey this is the Formbricks-hosted survey
    // page itself. `url` carries the whole thing including the query; `pagePath` is the query-free
    // page identity. There is no `pageUrl` - it read the same `location.href` as `url`.
    expect(meta.url).toContain(`/s/${surveyId}`);
    expect(meta.url).toContain("utm_source=newsletter");
    expect(meta.pagePath).toBe(`/s/${surveyId}`);

    // Campaign attribution, parsed off that same query string.
    expect(meta.utmSource).toBe("newsletter");
    expect(meta.utmMedium).toBe("email");
    expect(meta.utmCampaign).toBe("august-launch");
    expect(meta.utmTerm).toBe("pricing");
    expect(meta.utmContent).toBe("hero-cta");

    // Viewport is the window the survey was rendered into; screen is the device behind it.
    expect(meta.viewportWidth).toBe(1280);
    expect(meta.viewportHeight).toBeGreaterThan(0);
    expect(meta.screenWidth).toBeGreaterThan(0);
    expect(meta.screenHeight).toBeGreaterThan(0);

    // An IANA zone name, not a numeric offset — `Europe/Berlin` on a developer machine, `UTC` on a
    // CI container. Both are valid zone names; `+02:00` would not be, and is what this rules out.
    expect(meta.timezone).toMatch(/^[A-Za-z][A-Za-z0-9+_-]*(\/[A-Za-z0-9+_-]+)*$/);

    // The server-derived half is untouched by any of this: `userAgent` is still parsed from the
    // request header by UAParser, not taken from anything the page sent.
    expect((meta.userAgent as Record<string, unknown>).browser).toBeTruthy();
    // `source` is only set when the link carries an explicit `?source=`, which this one does not.
    expect(meta).not.toHaveProperty("source");
  });

  test("omits utm fields entirely when the link carries no campaign", async ({ page }) => {
    // Absent, not `""` — a blank campaign name would show up as a real value in exports and filters.
    await page.goto(surveyUrl ?? "");
    await submitAnswer(page, "Found it myself");

    const meta = await readStoredMeta(surveyId ?? "");

    for (const key of ["utmSource", "utmMedium", "utmCampaign", "utmTerm", "utmContent"]) {
      expect(meta).not.toHaveProperty(key);
    }
    expect(meta.pagePath).toBe(`/s/${surveyId}`);
  });

  test("freezes the viewport at display: resizing before submit does not change what is stored", async ({
    page,
  }) => {
    // The same acceptance criterion the unit test pins at the snapshot seam, proven through the real
    // renderer: the survey is displayed at 1280×800, the respondent then resizes to a phone-sized
    // window, and the stored response must still report the size the survey was displayed at.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(surveyUrl ?? "");
    await expect(page.getByText(QUESTION)).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText(QUESTION)).toBeVisible();

    await submitAnswer(page, "Resized mid-survey");

    const meta = await readStoredMeta(surveyId ?? "");

    expect(meta.viewportWidth).toBe(1280);
    expect(meta.viewportWidth).not.toBe(390);
  });
  test("shows the captured page, campaign and timezone in the product, without exporting", async ({
    page,
    users,
  }) => {
    // ENG-2540. ENG-1841 captures twelve fields on every response and, until this, none of them were
    // visible anywhere: an author could only reach them by exporting. The tests above prove the values
    // reach Postgres; this one proves an author can see them.
    //
    // Owns its whole fixture rather than reusing the shared survey above, because it needs a
    // logged-in owner: `users.create()` binds its `login()` to the page of the test that created it,
    // so the shared user from the first `beforeEach` cannot sign in here.
    const owner = await users.create({ skipSurveySeed: true });
    if (!owner.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const ownSurveyId = await seedSurvey(owner.workspaceId, owner.id);

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/s/${ownSurveyId}?${UTM_QUERY}`);
    await submitAnswer(page, "Seen in the product");
    // Kept, not discarded: the disclosure assertions below compare against what was actually stored,
    // so a wrong value projection cannot pass on the strength of the labels alone.
    const storedMeta = await readStoredMeta(ownSurveyId);

    await owner.login();
    await page.goto(`/workspaces/${owner.workspaceId}/surveys/${ownSurveyId}/responses`);

    await test.step("the new reserved columns are registered, but off by default", async () => {
      // The half that used to be impossible: the settings modal iterates the PERSISTED column order,
      // so before `reconcileColumnOrder` a newly added column id had no toggle and no drag handle.
      await page.getByRole("button", { name: "Table settings" }).click();

      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await expect(modal.getByText("Page Path", { exact: true })).toBeVisible();
      await expect(modal.getByText("UTM Source", { exact: true })).toBeVisible();

      // `DataTableSettingsModalItem` puts the column id on its Switch, so this is the column's own
      // toggle rather than a positional guess. Unchecked = the table did not silently grow thirteen
      // columns.
      await expect(modal.locator('[role="switch"]#METADATA_pagePath')).toHaveAttribute(
        "data-state",
        "unchecked"
      );
      // A field the table has always shown stays on.
      await expect(modal.locator('[role="switch"]#METADATA_url')).toHaveAttribute("data-state", "checked");

      await page.keyboard.press("Escape");
      await expect(modal).toBeHidden();
    });

    // The response card lives in the response modal, and the table is the default view. Clicking any
    // cell but `select` opens it (`ResponseTableCell.handleCellClick`); the dedicated "Expand
    // response" button is `group-hover:flex`, so it needs a hover dance this does not.
    await page.getByRole("cell", { name: "Anonymous" }).click();

    await test.step("the classic fields render exactly as before", async () => {
      // The seven the card has always shown, now looped from the catalog instead of written out as
      // seven JSX branches. Asserted on the tooltip container rather than per row: each row renders as
      // `{label}: {value}` across separate text nodes, so a `/^Browser:/` text locator does not match
      // one of them.
      const deviceInfo = page.getByRole("button", { name: "Device info" }).first();
      await expect(deviceInfo).toBeVisible({ timeout: 60000 });
      await deviceInfo.hover();

      const tooltip = page.getByRole("tooltip").filter({ hasText: "Device info" }).first();
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toContainText("Browser:");
      await expect(tooltip).toContainText("OS:");
      await expect(tooltip).toContainText("Device:");
      // `URL` proves the gating fix: the whole block used to be behind `hasUserAgent`, so with
      // "Anonymize responses" on — which drops `meta.userAgent` — url, action and source vanished too.
      await expect(tooltip).toContainText("URL:");
    });

    await test.step("the auto-captured fields sit behind a collapsed disclosure", async () => {
      const disclosure = page.getByTestId("auto-captured-fields").first();
      await expect(disclosure).toBeVisible();

      // Collapsed by default — thirteen extra rows on every card is the failure mode the ticket
      // names, so the values must NOT be on screen until asked for.
      await expect(disclosure.getByText("Page Path", { exact: true })).toBeHidden();

      await disclosure.getByRole("button", { name: /More context/ }).click();

      // Labels derived by `formatFieldNameToTitleCase`, so a catalog addition needs no new key.
      await expect(disclosure.getByText("Page Path", { exact: true })).toBeVisible();
      await expect(disclosure.getByText("UTM Source", { exact: true })).toBeVisible();
      await expect(disclosure.getByText("Timezone", { exact: true })).toBeVisible();
      await expect(disclosure.getByText("Viewport Width", { exact: true })).toBeVisible();
      // The values, not just the labels — and read back off the stored response rather than
      // hard-coded, so the display is checked against what capture actually wrote.
      await expect(disclosure.getByText("newsletter", { exact: true })).toBeVisible();
      await expect(disclosure.getByText(`/s/${ownSurveyId}`, { exact: true })).toBeVisible();
      expect(storedMeta.pagePath).toBe(`/s/${ownSurveyId}`);
      await expect(disclosure.getByText(String(storedMeta.timezone), { exact: true })).toBeVisible();
      await expect(
        disclosure.getByText(String(storedMeta.viewportWidth), { exact: true }).first()
      ).toBeVisible();
    });
  });
});

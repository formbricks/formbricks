import { type Locator, type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  surveyFlowFixture as fixture,
  SURVEY_FLOW_FIXTURE_IDS as ids,
} from "@formbricks/types/surveys/test-fixtures/survey-flow-fixture";
import { test } from "./lib/fixtures";

/**
 * **Survey flow, end to end (ENG-6939).**
 *
 * The unit seams pin each flow rule on its own: the block-flow decision, validation, v3, the Flow
 * outline model, the response routes and the results builders. This walks the one journey none of them
 * reach, across editor, survey bundle and server, on the same fixture survey they all read
 * (`survey-flow-fixture.ts`, "Streaming services 2026"):
 *
 *  1. The fixture is created through `POST /api/v3/surveys`, as an API client would.
 *  2. The Flow tab shows every construct: rules before the first question, block and question show-if,
 *     option show-if, Hidden and copied options, Set value with a formula, Mark as low quality, endings.
 *  3. Two respondents answer the link survey. The first (Netflix and Apple TV+) sees "What would convince
 *     you to try Apple TV+?" appear and disappear live as the answer above it changes. The second
 *     (Netflix, Disney+ and Prime Video) is offered only the options their earlier answers allow, gets a
 *     Set value result stored, and trips "If hours > 112 → Mark as low quality".
 *  4. Results: the response card shows "Not shown", the summary counts "Not shown to 2", and the
 *     response is Low quality.
 */

const LANGUAGE = "en-US";
const EMBEDDED_FIELDS = fixture.embeddedFields ?? [];

/** The fixture's `{ default: text }` strings as a v3 client writes them: keyed by the default language. */
const toV3Document = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(toV3Document);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 1 && entries[0][0] === "default" && typeof entries[0][1] === "string") {
      return { [LANGUAGE]: entries[0][1] };
    }
    return Object.fromEntries(entries.map(([key, entry]) => [key, toV3Document(entry)]));
  }
  return value;
};

/** The fixture as the body of `POST /api/v3/surveys`: the survey document, live, in a new workspace. */
const toV3CreateBody = (workspaceId: string) => ({
  workspaceId,
  name: fixture.name,
  type: fixture.type,
  status: "inProgress",
  defaultLanguage: LANGUAGE,
  welcomeCard: toV3Document(fixture.welcomeCard),
  startLogic: fixture.startLogic,
  blocks: toV3Document(fixture.blocks),
  endings: toV3Document(fixture.endings),
  hiddenFields: fixture.hiddenFields,
  variables: fixture.variables,
  embeddedFields: EMBEDDED_FIELDS.map(({ field, link }) => ({
    storageKey: link.storageKey,
    key: field.key,
    name: field.name,
    source: field.source,
    dataType: field.dataType,
    defaultValue: field.defaultValue,
    locked: field.locked,
  })),
});

const blockIdx = (blockId: string) => fixture.blocks.findIndex((block) => block.id === blockId);
const block = (blockId: string): TSurveyBlock => fixture.blocks[blockIdx(blockId)];
const headline = (elementId: string): string => {
  const element = fixture.blocks.flatMap((b) => b.elements).find((candidate) => candidate.id === elementId);
  if (!element) throw new Error(`The fixture has no element ${elementId}`);
  return element.headline.default;
};
const endingLabel = (endingId: string): string => {
  const ending = fixture.endings.find((candidate) => candidate.id === endingId);
  if (!ending) throw new Error(`The fixture has no ending ${endingId}`);
  return ending.type === "redirectToUrl" ? (ending.label ?? "") : (ending.headline?.default ?? "");
};

const THANKS = endingLabel(ids.endings.thanks);
const SERVICES = headline("services");
const FAV = headline("fav");
const APPLE_REASON = headline("apple_reason");
const BUNDLE = headline("bundle");
const RECOMMEND = headline("recommend");
const LOW_QUALITY_EMAIL = "jordan.lee@example.com";

/** The renderer's card of one block (`#questionCard--1` is the welcome card). */
const card = (page: Page, blockId: string | "welcome"): Locator =>
  page.locator(`#questionCard-${blockId === "welcome" ? -1 : blockIdx(blockId)}`);

/**
 * Picks an option the way a respondent does: by its label. The native input is visually hidden under
 * the styled control, so it is clicked through the label and then checked for being on.
 */
const choose = async (group: Locator, role: "checkbox" | "radio", name: string) => {
  await group
    .locator("label")
    .filter({ has: group.page().getByRole(role, { name, exact: true }) })
    .click();
  await expect(group.getByRole(role, { name, exact: true })).toBeChecked();
};

const pickServices = async (page: Page, services: string[]) => {
  const servicesGroup = card(page, ids.blocks.services).getByRole("group", { name: SERVICES });
  for (const service of services) {
    await choose(servicesGroup, "checkbox", service);
  }
  await card(page, ids.blocks.services).getByRole("button", { name: "Next" }).click();
};

/** Opens the link survey as a new respondent and passes the welcome card. */
const startSurvey = async (page: Page, surveyId: string, panelId: string) => {
  await page.goto(`/s/${surveyId}?${ids.hiddenFields.panelId}=${panelId}`);
  const welcome = card(page, "welcome");
  await expect(welcome.getByText(fixture.welcomeCard.headline?.default ?? "")).toBeVisible();
  await welcome.getByRole("button", { name: "Next" }).click();
};

/** Submits a page whose questions the respondent leaves unanswered. */
const skipPage = async (page: Page, blockId: string) => {
  const current = card(page, blockId);
  await expect(current.getByText(headline(block(blockId).elements[0].id))).toBeVisible();
  await current.getByRole("button", { name: "Next" }).click();
};

test.describe("Survey flow @slow", () => {
  test("a flow seeded through v3 shows on the Flow tab, runs in the link survey and reports in results", async ({
    page,
    users,
  }) => {
    const owner = await users.create({ skipSurveySeed: true });
    if (!owner.workspaceId) throw new Error("users.create() did not return a workspaceId");
    const { workspaceId } = owner;

    const surveyId = await test.step("the fixture survey is created through v3", async () => {
      // The fixture links one field from the workspace library by its key, so the library has it.
      const planTier = EMBEDDED_FIELDS.find((entry) => entry.field.key === "plan_tier")?.field;
      if (!planTier || planTier.source === "reserved") throw new Error("The fixture lost its library field");
      await prisma.embeddedData.create({
        data: {
          workspaceId,
          key: "plan_tier",
          name: planTier.name,
          source: planTier.source,
          dataType: planTier.dataType,
          defaultValue: planTier.defaultValue ?? undefined,
          locked: planTier.locked,
        },
      });

      await owner.login();
      const response = await page.request.post("/api/v3/surveys", { data: toV3CreateBody(workspaceId) });
      const body = (await response.json().catch(() => null)) as { data?: { id?: string } } | null;
      expect(response.status(), JSON.stringify(body)).toBe(201);
      if (typeof body?.data?.id !== "string") throw new TypeError("Survey create response carried no id");
      return body.data.id;
    });

    await test.step("the Flow tab shows every construct of the fixture", async () => {
      await page.goto(`/workspaces/${workspaceId}/surveys/${surveyId}/edit`);
      await page.getByRole("button", { name: "Flow", exact: true }).click();

      await expect(page.getByText("6 blocks · 4 endings")).toBeVisible();
      // Every block starts collapsed: open them all to see their questions and rules.
      await page.getByRole("button", { name: "Expand", exact: true }).click();

      // Rules before the first question: the screen-out on a missing panel id jumps to its ending.
      await expect(page.getByText("Before the first question")).toBeVisible();
      for (const rule of fixture.startLogic ?? []) {
        await expect(page.locator(`[id="${rule.id}"]`)).toBeVisible();
      }
      await expect(page.locator(`[id="${fixture.startLogic?.[0].id}"]`)).toContainText(
        endingLabel(ids.endings.notForYou)
      );

      // Every block, by name.
      for (const surveyBlock of fixture.blocks) {
        await expect(page.locator(`[id="flow-${surveyBlock.id}"]`)).toContainText(surveyBlock.name);
      }

      // Block show-if, question show-if, option show-if, a Hidden option and copied options.
      await expect(page.locator(`[id="flow-${ids.blocks.heavyUsers}"]`)).toContainText("Show if:");
      const question = (blockId: string, elementId: string) =>
        page
          .locator(`[id="flow-${blockId}"]`)
          .getByRole("listitem")
          .filter({ hasText: headline(elementId) });
      await expect(question(ids.blocks.overall, "apple_reason")).toContainText("Show if:");
      await expect(question(ids.blocks.overall, "fav")).toContainText("Show-if on 1 option");
      await expect(question(ids.blocks.overall, "bundle")).toContainText("1 hidden option");
      await expect(question(ids.blocks.profile, "recommend")).toContainText("Options copied from services");

      // Set value with a formula, and Mark as low quality.
      await expect(page.locator(`[id="${ids.setValue.scoreRule}"]`)).toContainText(
        "score = round(ifEmpty(@sat_netflix, 0) + ifEmpty(@sat_disney, 0) * 2, 1)"
      );
      await expect(page.locator(`[id="${ids.lowQuality.rule}"]`)).toContainText(
        "Mark response as Low quality"
      );

      // Endings, the redirect one by its label.
      for (const ending of fixture.endings) {
        await expect(page.locator(`[id="flow-${ending.id}"]`)).toContainText(
          `End: ${endingLabel(ending.id)}`
        );
      }
    });

    // The last page holds a Cal.com booking question, which loads its embed from cal.com. Nobody books
    // here, so the embed is refused: the journey never waits on, or fails with, outbound network.
    await page.route(
      (url) => url.hostname === "cal.com" || url.hostname.endsWith(".cal.com"),
      (route) => route.abort()
    );

    await test.step("a question appears live on its page as the answer above it changes", async () => {
      // Netflix and Apple TV+: "Heavy users" needs Netflix, Disney+ and Prime Video, so it is skipped.
      await startSurvey(page, surveyId, "panel-1001");
      await pickServices(page, ["Netflix", "Apple TV+"]);
      await skipPage(page, ids.blocks.ratings);
      await skipPage(page, ids.blocks.concept);

      const overall = card(page, ids.blocks.overall);
      const fav = overall.getByRole("radiogroup", { name: FAV });
      const appleReason = overall.getByText(APPLE_REASON);
      await expect(fav).toBeVisible();
      await expect(appleReason).toBeHidden();

      await choose(fav, "radio", "Apple TV+");
      await expect(appleReason).toBeVisible();
      // A Hidden option is never offered, even when its own show-if matches.
      await expect(
        overall.getByRole("radiogroup", { name: BUNDLE }).getByRole("radio", { name: "Netflix + Apple TV+" })
      ).toHaveCount(0);

      await choose(fav, "radio", "Netflix");
      await expect(appleReason).toBeHidden();

      await overall.getByRole("button", { name: "Next" }).click();
      // The ending renders once the response write resolves; the first one of a run can be slow.
      await expect(page.getByText(THANKS)).toBeVisible({ timeout: 60000 });
    });

    await test.step("later questions offer only what earlier answers allow, and Low quality fires", async () => {
      await page.evaluate(() => window.localStorage.clear());
      await startSurvey(page, surveyId, "panel-1002");
      await pickServices(page, ["Netflix", "Disney+", "Prime Video"]);
      await skipPage(page, ids.blocks.ratings);

      // "Heavy users" is shown; 150 hours a week trips "If hours > 112 → Mark as low quality".
      const heavyUsers = card(page, ids.blocks.heavyUsers);
      await expect(heavyUsers.getByText(headline("hours"))).toBeVisible();
      await heavyUsers.getByRole("textbox", { name: headline("hours") }).fill("150");
      await heavyUsers.getByRole("button", { name: "Next" }).click();

      // A 7 keeps the concept rules (score × 2, score ÷ 2) out of the way of the Set value result.
      const concept = card(page, ids.blocks.concept);
      await choose(concept, "radio", "Rate 7 out of 10");
      await concept.getByRole("button", { name: "Next" }).click();

      // Apple TV+ was not picked, so "Which one would you miss the most?" does not offer it.
      const overall = card(page, ids.blocks.overall);
      const fav = overall.getByRole("radiogroup", { name: FAV });
      await expect(fav.getByRole("radio")).toHaveCount(3);
      await expect(fav.getByRole("radio", { name: "Apple TV+" })).toHaveCount(0);
      await expect(overall.getByText(APPLE_REASON)).toBeHidden();
      await choose(fav, "radio", "Netflix");
      await choose(overall.getByRole("radiogroup", { name: BUNDLE }), "radio", "Netflix + Disney+");
      await overall.getByRole("textbox", { name: headline("email") }).fill(LOW_QUALITY_EMAIL);
      await overall.getByRole("button", { name: "Next" }).click();

      // Copied options: only the services picked on the first page, plus the fixed "None of these".
      const profile = card(page, ids.blocks.profile);
      const recommend = profile.getByRole("group", { name: RECOMMEND });
      await expect(recommend).toBeVisible();
      for (const option of ["Netflix", "Disney+", "Prime Video", "None of these"]) {
        await expect(recommend.getByRole("checkbox", { name: option, exact: true })).toBeVisible();
      }
      await expect(recommend.getByRole("checkbox", { name: "Apple TV+" })).toHaveCount(0);
      await profile.getByRole("button", { name: "Finish" }).click();
      await expect(page.getByText(THANKS)).toBeVisible({ timeout: 60000 });

      // The stored response: marked Low quality, with the Set value result
      // score = max(min(abs(150 − 40), 100), 150 ÷ 2) = 100, and its not-shown record.
      await expect
        .poll(
          async () => {
            const responses = await prisma.response.findMany({
              where: { surveyId },
              select: { data: true, outcome: true, variables: true, notShown: true },
            });
            const response = responses.find(
              (candidate) => (candidate.data as Record<string, unknown>).email === LOW_QUALITY_EMAIL
            );
            return (
              response && {
                outcome: response.outcome,
                score: (response.variables as Record<string, unknown>)[ids.variables.score],
                notShown: response.notShown,
              }
            );
          },
          { timeout: 20000, message: "The low quality response should be stored" }
        )
        .toMatchObject({
          outcome: "lowQuality",
          score: 100,
          notShown: {
            elements: ["apple_reason"],
            options: { fav: ["apple"], bundle: ["netflix_apple"], recommend: ["apple"] },
          },
        });
    });

    await test.step("the response card shows Not shown and Low quality, the summary counts it", async () => {
      await page.goto(`/workspaces/${workspaceId}/surveys/${surveyId}/responses`);
      const notShown = page.getByTestId("response-card-not-shown");
      // A click on the row before the table hydrates opens nothing, so it is retried until the card opens.
      await expect(async () => {
        await page.getByRole("row").filter({ hasText: LOW_QUALITY_EMAIL }).click();
        await expect(notShown).toBeVisible({ timeout: 2000 });
      }).toPass({ timeout: 30000 });
      await expect(page.getByTestId("response-card-not-shown-group")).toContainText(APPLE_REASON);
      // A Low quality response offers to be restored as complete.
      await expect(page.getByRole("button", { name: "Restore as complete" })).toBeVisible();
      await page.keyboard.press("Escape");

      await page.goto(`/workspaces/${workspaceId}/surveys/${surveyId}/summary`);
      // Both respondents left the Overall page with it hidden, so both count.
      const appleReasonHeader = page.getByTestId("element-summary-header-apple_reason");
      await expect(appleReasonHeader.getByRole("heading", { name: APPLE_REASON, exact: true })).toBeVisible();
      await expect(appleReasonHeader).toContainText("Not shown to 2");
    });
  });
});

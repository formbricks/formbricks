import { type Page, expect } from "@playwright/test";
import { prisma } from "@formbricks/database";
import { UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES } from "@formbricks/types/feedback-source";
import { test } from "./lib/fixtures";
import { createSurveyFromScratch } from "./utils/helper";

// ENG-2064. A feedback source stores one mapping row per survey question it publishes to Hub, and the
// publish path iterates those rows rather than the survey. So when a survey is edited, any drift
// between the rows and the questions is silent data loss or silent wrong-typed data — nothing errors,
// answers just stop arriving. This spec drives a real editor save and asserts on the rows.
//
// Everything except the save is seeded through Prisma on purpose: it keeps the run fast and stable,
// and it reaches states the UI cannot produce at all (a source mapping two surveys — see ENG-2341).
// The surrounding create/edit/CSV surface is ENG-2357.

type TSeededElement = { id: string; type: string };

const readSurveyElements = async (surveyId: string): Promise<TSeededElement[]> => {
  const survey = await prisma.survey.findUniqueOrThrow({
    where: { id: surveyId },
    select: { blocks: true },
  });

  return (survey.blocks as unknown as { elements: TSeededElement[] }[]).flatMap(
    (block) => block.elements ?? []
  );
};

// Imported, not re-declared: this is the same list the reconciler gates on, so a type added to
// the product constant has to show up here too rather than leaving the spec asserting an old six.
const UNMAPPABLE_ELEMENT_TYPES = new Set<string>(UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES);

const seedDirectory = async (organizationId: string, workspaceId: string): Promise<string> => {
  const directory = await prisma.feedbackDirectory.create({
    data: { name: `E2E Directory ${workspaceId}`, organizationId },
  });
  // The source carries a composite FK onto this assignment row, so it must exist first.
  await prisma.feedbackDirectoryWorkspace.create({
    data: { feedbackDirectoryId: directory.id, workspaceId },
  });
  return directory.id;
};

const seedSource = async (params: {
  name: string;
  workspaceId: string;
  feedbackDirectoryId: string;
  elementScope: "all" | "specific";
  mappings: { surveyId: string; elementId: string; hubFieldType: "text" | "rating" | "nps" }[];
}): Promise<string> => {
  const source = await prisma.feedbackSource.create({
    data: {
      name: params.name,
      type: "formbricks_survey",
      status: "active",
      elementScope: params.elementScope,
      workspaceId: params.workspaceId,
      feedbackDirectoryId: params.feedbackDirectoryId,
    },
  });

  await prisma.feedbackSourceFormbricksMapping.createMany({
    data: params.mappings.map((mapping) => ({
      ...mapping,
      feedbackSourceId: source.id,
      workspaceId: params.workspaceId,
    })),
  });

  return source.id;
};

/** A plain draft save — the survey editor's own write path into updateSurveyInternal. */
const saveDraft = async (page: Page): Promise<void> => {
  await page.getByRole("button", { name: "Save as draft", exact: true }).click();
  await expect(page.getByText("Changes saved.", { exact: true })).toBeVisible({ timeout: 15000 });
};

const mappedElementIds = async (feedbackSourceId: string, surveyId: string): Promise<string[]> => {
  const rows = await prisma.feedbackSourceFormbricksMapping.findMany({
    where: { feedbackSourceId, surveyId },
    select: { elementId: true },
    orderBy: { elementId: "asc" },
  });
  return rows.map((row) => row.elementId);
};

test.describe("Feedback source reconciliation @slow", () => {
  test.setTimeout(1000 * 60 * 3);

  test("a survey save reconciles its sources, honouring elementScope and sibling surveys", async ({
    page,
    users,
  }) => {
    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    const surveyId = await createSurveyFromScratch(page);
    const workspaceId = (
      await prisma.survey.findUniqueOrThrow({ where: { id: surveyId }, select: { workspaceId: true } })
    ).workspaceId;
    const organizationId = user.organizationId;
    if (!organizationId) throw new Error("Organization not seeded for test");

    // A second survey, mapped by the same source, that this test never edits.
    const siblingSurvey = await prisma.survey.create({
      data: { workspaceId, name: `Sibling ${surveyId}`, status: "draft", type: "link" },
    });

    const elements = await readSurveyElements(surveyId);
    const supported = elements.filter((element) => !UNMAPPABLE_ELEMENT_TYPES.has(element.type));
    expect(supported.length).toBeGreaterThan(0);

    // The retype target is pinned to a known element type so the expectation below can be a literal.
    // Asserting "not nps" would pass for any wrong value the reconciler happened to write.
    const retypeTarget = supported.find((element) => element.type === "openText");
    expect(retypeTarget, "fixture must contain an openText question").toBeDefined();
    const RETYPE_EXPECTED_HUB_FIELD_TYPE = "text";

    const feedbackDirectoryId = await seedDirectory(organizationId, workspaceId);
    const STALE = "el-deleted-from-the-survey";
    const SIBLING_ELEMENT = "el-belongs-to-the-sibling-survey";

    // Tracks everything: must drop the stale row AND pick up every real question. Also holds a row for
    // the sibling survey, which must be untouched.
    const trackAllSourceId = await seedSource({
      name: `E2E all ${surveyId}`,
      workspaceId,
      feedbackDirectoryId,
      elementScope: "all",
      mappings: [
        { surveyId, elementId: STALE, hubFieldType: "text" },
        { surveyId: siblingSurvey.id, elementId: SIBLING_ELEMENT, hubFieldType: "nps" },
      ],
    });

    // Curated subset, held back: its only row for this survey is stale, so the "never leave a survey
    // with zero mappings" guard should keep that row rather than orphan the source.
    const curatedHeldBackSourceId = await seedSource({
      name: `E2E specific held-back ${surveyId}`,
      workspaceId,
      feedbackDirectoryId,
      elementScope: "specific",
      mappings: [{ surveyId, elementId: STALE, hubFieldType: "text" }],
    });

    // Curated subset, reconciled. Two rows, so the hold-back does not apply: the stale one must be
    // deleted and the real one retyped. This is the discriminating signal — a specific-scope source
    // that reconciliation genuinely visited, changed, and still did not let adopt the other questions.
    //
    // It has to be a separate source from the held-back one: adding any second row there would make
    // `removed.length + unmappable.length === surveyMappingCount` false and delete the stale row,
    // silently retargeting the assertion above at a scenario it no longer covers.
    const curatedRetypedSourceId = await seedSource({
      name: `E2E specific retyped ${surveyId}`,
      workspaceId,
      feedbackDirectoryId,
      elementScope: "specific",
      mappings: [
        { surveyId, elementId: STALE, hubFieldType: "text" },
        { surveyId, elementId: retypeTarget!.id, hubFieldType: "nps" },
      ],
    });

    // The trigger: one ordinary editor save of the survey, no question edits needed. The seeded rows
    // already describe a survey that has drifted.
    await saveDraft(page);

    await expect
      .poll(() => mappedElementIds(trackAllSourceId, surveyId), { timeout: 15000 })
      .toEqual(supported.map((element) => element.id).sort((a, b) => a.localeCompare(b)));

    // Sibling survey's row survives — editing one survey must not touch another's mappings.
    expect(await mappedElementIds(trackAllSourceId, siblingSurvey.id)).toEqual([SIBLING_ELEMENT]);

    // The discriminating wait: this row set only becomes [supported[0]] once reconciliation has
    // reached a *specific*-scope source and both deleted the stale row and kept the curated one.
    // Seeded [STALE, supported[0]], asserted [supported[0]] — it cannot pass if reconciliation never
    // ran, never matched the source, or threw. Being an exact-set equality, it also covers the other
    // half: a curated source adopts none of the questions it was never mapped to.
    await expect
      .poll(() => mappedElementIds(curatedRetypedSourceId, surveyId), { timeout: 15000 })
      .toEqual([retypeTarget!.id]);

    // ...and it was retyped rather than left stale.
    const retyped = await prisma.feedbackSourceFormbricksMapping.findFirstOrThrow({
      where: { feedbackSourceId: curatedRetypedSourceId, surveyId, elementId: retypeTarget!.id },
      select: { hubFieldType: true },
    });
    // The exact type openText maps to, not merely "something other than nps" — that weaker form
    // passes for any wrong value reconciliation might write.
    expect(retyped.hubFieldType).toBe(RETYPE_EXPECTED_HUB_FIELD_TYPE);

    // The held-back source kept its single stale row instead of being orphaned. Credible now: the
    // poll above proves this save already reconciled a specific-scope source.
    expect(await mappedElementIds(curatedHeldBackSourceId, surveyId)).toEqual([STALE]);
  });

  test("a retyped question has its hubFieldType corrected rather than left stale", async ({
    page,
    users,
  }) => {
    const user = await users.create();
    await user.login();
    await page.waitForURL(/\/workspaces\/[^/]+\/surveys/);

    const surveyId = await createSurveyFromScratch(page);
    const workspaceId = (
      await prisma.survey.findUniqueOrThrow({ where: { id: surveyId }, select: { workspaceId: true } })
    ).workspaceId;
    const organizationId = user.organizationId;
    if (!organizationId) throw new Error("Organization not seeded for test");

    const elements = await readSurveyElements(surveyId);
    const target = elements.find((element) => !UNMAPPABLE_ELEMENT_TYPES.has(element.type));
    if (!target) throw new Error("Survey has no mappable element to retype against");

    const feedbackDirectoryId = await seedDirectory(organizationId, workspaceId);
    // Deliberately wrong: claims the element publishes as an NPS score. Reconciliation must correct it
    // to whatever the element's real type maps to, and must keep the row rather than delete it.
    const sourceId = await seedSource({
      name: `E2E retype ${surveyId}`,
      workspaceId,
      feedbackDirectoryId,
      elementScope: "specific",
      mappings: [{ surveyId, elementId: target.id, hubFieldType: "nps" }],
    });

    await saveDraft(page);

    await expect
      .poll(
        async () => {
          const row = await prisma.feedbackSourceFormbricksMapping.findFirstOrThrow({
            where: { feedbackSourceId: sourceId, surveyId, elementId: target.id },
            select: { hubFieldType: true },
          });
          return row.hubFieldType;
        },
        { timeout: 15000 }
      )
      .not.toBe("nps");
  });
});

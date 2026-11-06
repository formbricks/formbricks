import { beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { type TDashboardsFixture, seedDashboardsFixture } from "@/integration/dashboards-fixture";
import { getAnswerQuestions } from "./answer-questions";

/**
 * `getAnswerQuestions` (ENG-6637) against real PostgreSQL: the two queries behind the answer-filter
 * question list, scoped to one workspace and one Feedback Dataset. The pure merging rules are unit-tested
 * in `answer-questions.test.ts`; this pins the relations and the tenant scoping those queries rely on.
 */

const headline = (text: string) => ({ default: text });

const BLOCKS = [
  {
    id: "clbk1234567890123456789014",
    name: "Main",
    elements: [
      {
        id: "delivery",
        type: "multipleChoiceSingle",
        headline: headline("How was delivery?"),
        required: false,
        shuffleOption: "none",
        choices: [
          { id: "late", label: headline("Late") },
          { id: "on_time", label: headline("On time") },
        ],
      },
      {
        id: "nps",
        type: "nps",
        headline: headline("How likely are you to recommend us?"),
        required: false,
      },
      {
        id: "comment",
        type: "openText",
        headline: headline("Anything else?"),
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

let fixture: TDashboardsFixture;
const ids = { survey: "", otherWorkspaceSurvey: "", source: "", emptyDataset: "" };

const addSource = async (workspaceId: string, feedbackDirectoryId: string, name: string) =>
  (
    await prisma.feedbackSource.create({
      data: { name, type: "formbricks_survey", workspaceId, feedbackDirectoryId },
    })
  ).id;

beforeAll(async () => {
  fixture = await seedDashboardsFixture();

  ids.survey = (
    await prisma.survey.create({
      data: { name: "Delivery", workspaceId: fixture.workspaceId, blocks: BLOCKS as never },
    })
  ).id;
  ids.source = await addSource(fixture.workspaceId, fixture.datasetId, "Delivery survey");
  for (const [elementId, hubFieldType, customFieldLabel] of [
    ["delivery", "categorical", null],
    ["nps", "nps", "Recommend"],
    ["comment", "text", null],
    // A mapping to an element the survey no longer has is skipped, not an error.
    ["removed", "categorical", null],
  ] as const) {
    await prisma.feedbackSourceFormbricksMapping.create({
      data: {
        feedbackSourceId: ids.source,
        workspaceId: fixture.workspaceId,
        surveyId: ids.survey,
        elementId,
        hubFieldType,
        customFieldLabel,
      },
    });
  }

  // The same dataset assigned to another workspace of the organization, with a mapping of its own: it must
  // not leak into the first workspace's list, nor the first workspace's into it.
  await prisma.feedbackDirectoryWorkspace.create({
    data: { feedbackDirectoryId: fixture.datasetId, workspaceId: fixture.otherWorkspaceId },
  });
  ids.otherWorkspaceSurvey = (
    await prisma.survey.create({
      data: { name: "Other", workspaceId: fixture.otherWorkspaceId, blocks: BLOCKS as never },
    })
  ).id;
  const otherSource = await addSource(fixture.otherWorkspaceId, fixture.datasetId, "Other survey");
  await prisma.feedbackSourceFormbricksMapping.create({
    data: {
      feedbackSourceId: otherSource,
      workspaceId: fixture.otherWorkspaceId,
      surveyId: ids.otherWorkspaceSurvey,
      elementId: "nps",
      hubFieldType: "nps",
      customFieldLabel: "Other workspace NPS",
    },
  });

  // A dataset assigned to the workspace that no source feeds.
  ids.emptyDataset = (
    await prisma.feedbackDirectory.create({
      data: { name: "Empty", organizationId: fixture.organizationId },
    })
  ).id;
  await prisma.feedbackDirectoryWorkspace.create({
    data: { feedbackDirectoryId: ids.emptyDataset, workspaceId: fixture.workspaceId },
  });
}, 120_000);

describe("getAnswerQuestions against PostgreSQL", () => {
  test("lists the answerable questions of the dataset's sources in this workspace, by label", async () => {
    const questions = await getAnswerQuestions(fixture.workspaceId, fixture.datasetId);

    expect(questions.map(({ id, label, kind }) => ({ id, label, kind }))).toEqual([
      { id: "delivery", label: "How was delivery?", kind: "choice" },
      { id: "nps", label: "Recommend", kind: "number" },
    ]);
    expect(questions[0].options).toEqual([
      { value: "late", label: "Late" },
      { value: "on_time", label: "On time" },
    ]);
    expect(questions[1].options).toHaveLength(11);
  });

  test("keeps each workspace's mappings to itself, though the dataset is shared", async () => {
    const questions = await getAnswerQuestions(fixture.otherWorkspaceId, fixture.datasetId);

    expect(questions.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "nps", label: "Other workspace NPS" },
    ]);
  });

  test("answers no questions for a dataset no source feeds, or one of another organization", async () => {
    await expect(getAnswerQuestions(fixture.workspaceId, ids.emptyDataset)).resolves.toEqual([]);
    await expect(getAnswerQuestions(fixture.workspaceId, fixture.foreignDatasetId)).resolves.toEqual([]);
  });

  test("never reads a survey of another workspace, even when a mapping names one", async () => {
    // A workspace id paired with the other workspace's dataset source: nothing matches the scoping.
    await expect(getAnswerQuestions(fixture.foreignWorkspaceId, fixture.datasetId)).resolves.toEqual([]);
  });
});

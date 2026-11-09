import { beforeEach, describe, expect, test, vi } from "vitest";
import { getDatasetChartFieldCatalog, getDatasetChartFields } from "./dataset-chart-fields";

const { mockGetKeys, mockResolve, mockGetAnswerQuestions, mockGetDatasetTopics } = vi.hoisted(() => ({
  mockGetKeys: vi.fn(),
  mockResolve: vi.fn(),
  mockGetAnswerQuestions: vi.fn(),
  mockGetDatasetTopics: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./dataset-embedded-keys", () => ({
  getDatasetEmbeddedKeys: mockGetKeys,
  resolveEmbeddedMemberKeys: mockResolve,
}));
vi.mock("./embedded-member-name", () => ({
  getEmbeddedMemberName: (key: string) => `FeedbackRecords.ed_${key}_00000000`,
}));
vi.mock("@/modules/ee/analysis/charts/lib/answer-questions", () => ({
  getAnswerQuestions: mockGetAnswerQuestions,
}));
vi.mock("./dataset-topics", () => ({ getDatasetTopics: mockGetDatasetTopics }));

const scope = {
  datasetId: "frd-1",
  workspaceId: "workspace-1",
  organizationId: "organization-1",
  actor: { type: "user" as const, id: "user-1" },
};
const PLAN = "FeedbackRecords.ed_plan_00000000";
const RARE = "FeedbackRecords.ed_rare_00000000";

describe("getDatasetChartFields (ENG-6893)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKeys.mockResolvedValue(["plan"]);
    mockResolve.mockResolvedValue(new Map());
    mockGetAnswerQuestions.mockResolvedValue([]);
  });

  test("offers the dataset's top keys, and no answer questions unless asked", async () => {
    await expect(getDatasetChartFields(scope)).resolves.toEqual({
      embeddedFields: [{ name: PLAN, key: "plan" }],
    });
    expect(mockResolve).not.toHaveBeenCalled();
    expect(mockGetAnswerQuestions).not.toHaveBeenCalled();
  });

  test("has no embedded fields for a dataset without keys", async () => {
    mockGetKeys.mockResolvedValue([]);
    await expect(getDatasetChartFields(scope)).resolves.toEqual({ embeddedFields: [] });
  });

  test("adds a saved query's key that fell out of the top keys, so the query still validates", async () => {
    mockResolve.mockResolvedValue(new Map([[RARE, "rare"]]));

    const fields = await getDatasetChartFields(scope, { query: { dimensions: [PLAN, RARE] } });

    expect(mockResolve).toHaveBeenCalledWith(scope, [RARE]);
    expect(fields.embeddedFields).toEqual([
      { name: PLAN, key: "plan" },
      { name: RARE, key: "rare" },
    ]);
  });

  test("leaves out a member whose key the dataset no longer has", async () => {
    const fields = await getDatasetChartFields(scope, { query: { dimensions: [RARE] } });
    expect(fields.embeddedFields).toEqual([{ name: PLAN, key: "plan" }]);
  });

  test("loads answer questions when the query holds an answer rule, or when asked", async () => {
    mockGetAnswerQuestions.mockResolvedValue([{ id: "q1", label: "Q", kind: "choice", options: [] }]);

    const asked = await getDatasetChartFields(scope, { withAnswerQuestions: true });
    expect(asked.answerQuestions).toHaveLength(1);
    expect(mockGetAnswerQuestions).toHaveBeenCalledWith("workspace-1", "frd-1");
  });

  test("the catalog is the shared fields then the dataset's keys, never a saved query's extras", async () => {
    const catalog = await getDatasetChartFieldCatalog(scope);
    expect(catalog.at(-1)).toMatchObject({ name: PLAN, label: "plan", kind: "dimension" });
    expect(mockResolve).not.toHaveBeenCalled();
  });
});

describe("getDatasetChartFields with topics (ENG-6989)", () => {
  const topics = {
    status: "active" as const,
    labels: { topics: ["Billing"], subtopics: ["Billing › Refunds"] },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetKeys.mockResolvedValue([]);
    mockResolve.mockResolvedValue(new Map());
    mockGetDatasetTopics.mockResolvedValue(topics);
  });

  test("reads the dataset's topics only when asked, so a saved chart's read costs no Hub call", async () => {
    await expect(getDatasetChartFields(scope, { withTopics: true })).resolves.toEqual({
      embeddedFields: [],
      topics,
    });
    expect(mockGetDatasetTopics).toHaveBeenCalledWith({
      datasetId: "frd-1",
      organizationId: "organization-1",
    });

    mockGetDatasetTopics.mockClear();
    await expect(
      getDatasetChartFields(scope, { query: { dimensions: ["FeedbackRecords.topic"] } })
    ).resolves.toEqual({
      embeddedFields: [],
    });
    expect(mockGetDatasetTopics).not.toHaveBeenCalled();
  });

  test("passes on why topics are missing, for the validator to name", async () => {
    mockGetDatasetTopics.mockResolvedValue({ status: "inactive" });

    await expect(getDatasetChartFields(scope, { withTopics: true })).resolves.toEqual({
      embeddedFields: [],
      topics: { status: "inactive" },
    });
  });

  test("lists the topic fields in the whole catalog of a dataset with an active taxonomy", async () => {
    const names = (await getDatasetChartFieldCatalog(scope)).map((field) => field.name);
    expect(names).toEqual(
      expect.arrayContaining(["FeedbackRecords.topic", "FeedbackRecords.responseSubtopic"])
    );
  });
});

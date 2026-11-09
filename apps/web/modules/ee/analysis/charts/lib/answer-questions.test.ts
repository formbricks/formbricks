import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  ANSWER_QUESTIONS_CACHE_TTL_MS,
  MAX_ANSWER_QUESTION_MAPPINGS,
  collectAnswerQuestions,
  getAnswerQuestions,
} from "./answer-questions";

const { mockPrisma, mockWithCache } = vi.hoisted(() => ({
  mockPrisma: {
    feedbackSourceFormbricksMapping: { findMany: vi.fn() },
    survey: { findMany: vi.fn() },
  },
  mockWithCache: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@formbricks/database", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/cache", () => ({ cache: { withCache: mockWithCache } }));

const choice = (id: string, label: string) => ({ id, label: { default: label } });
const select = (
  id: string,
  type: "multipleChoiceSingle" | "multipleChoiceMulti",
  headline: string,
  choices: string[]
) => ({
  id,
  type,
  headline: { default: headline },
  choices: choices.map((label) => choice(`opt_${label.toLowerCase()}`, label)),
});
const survey = (id: string, elements: unknown[]) => ({ id, blocks: [{ id: `b-${id}`, elements }] });
const mapping = (surveyId: string, elementId: string, customFieldLabel: string | null = null) => ({
  surveyId,
  elementId,
  customFieldLabel,
});

describe("collectAnswerQuestions (ENG-6637)", () => {
  test("has nothing to offer for a dataset without surveys", () => {
    expect(collectAnswerQuestions([], [])).toEqual([]);
  });

  test("offers each answerable question with its kind and the value keys its records store", () => {
    const surveys = [
      survey("s1", [
        select("q_delivery", "multipleChoiceSingle", "How was delivery?", ["Late", "Early"]),
        select("q_feat", "multipleChoiceMulti", "Which features?", ["Surveys", "Charts"]),
        { id: "q_nps", type: "nps", headline: { default: "Recommend us?" } },
        { id: "q_rating", type: "rating", headline: { default: "Rate us" }, scale: "star", range: 5 },
        { id: "q_csat", type: "csat", headline: { default: "Satisfied?" }, scale: "number", range: 5 },
        { id: "q_ces", type: "ces", headline: { default: "Effort" }, scale: "number", range: 7 },
        { id: "q_text", type: "openText", headline: { default: "Anything else?" } },
        { id: "q_matrix", type: "matrix", headline: { default: "Grid" }, rows: [], columns: [] },
      ]),
    ];
    const questions = collectAnswerQuestions(
      ["q_delivery", "q_feat", "q_nps", "q_rating", "q_csat", "q_ces", "q_text", "q_matrix"].map((id) =>
        mapping("s1", id)
      ),
      surveys
    );

    expect(questions.map(({ id, kind, label }) => ({ id, kind, label }))).toEqual([
      { id: "q_ces", kind: "number", label: "Effort" },
      { id: "q_delivery", kind: "choice", label: "How was delivery?" },
      { id: "q_rating", kind: "number", label: "Rate us" },
      { id: "q_nps", kind: "number", label: "Recommend us?" },
      { id: "q_csat", kind: "number", label: "Satisfied?" },
      { id: "q_feat", kind: "multi", label: "Which features?" },
    ]);
    const byId = Object.fromEntries(questions.map((question) => [question.id, question.options]));
    expect(byId.q_delivery).toEqual([
      { value: "opt_late", label: "Late" },
      { value: "opt_early", label: "Early" },
    ]);
    expect(byId.q_nps.map((option) => option.value)).toEqual([
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "10",
    ]);
    expect(byId.q_ces.map((option) => option.value)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
  });

  test("merges a question id several surveys share, and keeps the first kind when they disagree", () => {
    const surveys = [
      survey("s1", [select("q_delivery", "multipleChoiceSingle", "Delivery", ["Late"])]),
      survey("s2", [select("q_delivery", "multipleChoiceSingle", "Delivery (US)", ["Late", "Lost"])]),
      survey("s3", [select("q_delivery", "multipleChoiceMulti", "Delivery issues", ["Damaged"])]),
    ];
    const [question, ...rest] = collectAnswerQuestions(
      [
        mapping("s1", "q_delivery", "Delivery speed"),
        mapping("s2", "q_delivery"),
        mapping("s3", "q_delivery"),
      ],
      surveys
    );

    expect(rest).toEqual([]);
    expect(question).toEqual({
      id: "q_delivery",
      label: "Delivery speed",
      kind: "choice",
      options: [
        { value: "opt_late", label: "Late" },
        { value: "opt_lost", label: "Lost" },
      ],
    });
  });

  test("skips mappings whose survey or element is gone", () => {
    expect(
      collectAnswerQuestions([mapping("gone", "q1"), mapping("s1", "gone")], [survey("s1", [])])
    ).toEqual([]);
  });
});

describe("getAnswerQuestions (C7)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithCache.mockImplementation(async (fn: () => Promise<unknown>) => fn());
  });

  test("is one short-lived cache entry per workspace and dataset, shared by the validator and the token", async () => {
    mockPrisma.feedbackSourceFormbricksMapping.findMany.mockResolvedValue([]);

    await expect(getAnswerQuestions("workspace-1", "frd-1")).resolves.toEqual([]);
    expect(mockWithCache).toHaveBeenCalledWith(
      expect.any(Function),
      "fb:analytics:frd-1:answer-questions-workspace-1",
      ANSWER_QUESTIONS_CACHE_TTL_MS
    );
    expect(ANSWER_QUESTIONS_CACHE_TTL_MS).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  test("reads a bounded number of mappings and only the fields it needs", async () => {
    mockPrisma.feedbackSourceFormbricksMapping.findMany.mockResolvedValue([mapping("s1", "q_delivery")]);
    mockPrisma.survey.findMany.mockResolvedValue([
      survey("s1", [select("q_delivery", "multipleChoiceSingle", "Delivery", ["Late"])]),
    ]);

    const questions = await getAnswerQuestions("workspace-1", "frd-1");

    expect(questions.map((question) => question.id)).toEqual(["q_delivery"]);
    expect(mockPrisma.feedbackSourceFormbricksMapping.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: MAX_ANSWER_QUESTION_MAPPINGS,
        select: { surveyId: true, elementId: true, customFieldLabel: true },
      })
    );
    expect(mockPrisma.survey.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, blocks: true } })
    );
  });

  test("never queries surveys for a dataset without mappings", async () => {
    mockPrisma.feedbackSourceFormbricksMapping.findMany.mockResolvedValue([]);
    await getAnswerQuestions("workspace-1", "frd-1");
    expect(mockPrisma.survey.findMany).not.toHaveBeenCalled();
  });
});

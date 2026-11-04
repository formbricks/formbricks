import { describe, expect, test, vi } from "vitest";
import { type TSurveyQuota } from "@formbricks/types/quota";
import { type TConditionGroup } from "@formbricks/types/surveys/logic";
import {
  answeredInGerman,
  editorRatedGood,
  multilingualSurvey,
  pickedPro,
  rankedSpeed,
} from "@/lib/surveyLogic/test-fixtures/multilingual-answers";
import { evaluateQuotas } from "./utils";

vi.mock("@formbricks/database", () => ({ prisma: {} }));
vi.mock("@/lib/response/service", () => ({ updateResponse: vi.fn() }));
vi.mock("@formbricks/logger", () => ({ logger: { error: vi.fn() } }));

/**
 * ENG-6943: a quota counts a response whose answers were given in another language of the survey
 * (a respondent who switched language after answering), the real survey logic deciding.
 */

const quota = (id: string, conditions: TConditionGroup): TSurveyQuota => ({
  id,
  createdAt: new Date(),
  updatedAt: new Date(),
  surveyId: "survey1",
  name: id,
  limit: 10,
  logic: { connector: "and", conditions: conditions.conditions },
  action: "endSurvey",
  endingCardId: null,
  countPartialSubmissions: false,
});

describe("quotas on answers stored in another language", () => {
  test("a choice, a ranking and a matrix answer each count", () => {
    const quotas = [
      quota("q-plan", pickedPro),
      quota("q-rank", rankedSpeed),
      quota("q-grid", editorRatedGood),
    ];

    const { passedQuotas, failedQuotas } = evaluateQuotas(
      multilingualSurvey,
      answeredInGerman,
      {},
      quotas,
      "default"
    );

    expect(passedQuotas.map((passed) => passed.id)).toEqual(["q-plan", "q-rank", "q-grid"]);
    expect(failedQuotas).toEqual([]);
  });
});

import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { type TResponseData } from "@formbricks/types/responses";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { type TConditionGroup, type TSingleCondition } from "@formbricks/types/surveys/logic";

/**
 * A survey in English (`default`) and German, answered in German, and conditions on each kind of
 * answer stored as a label: a single select, a ranking and a matrix row (ENG-6943).
 */

const label = (en: string, de: string) => ({ default: en, de });

export const multilingualSurvey = {
  id: "survey1",
  name: "Survey",
  blocks: [
    {
      id: "b1",
      name: "b1",
      elements: [
        {
          id: "plan",
          type: TSurveyElementTypeEnum.MultipleChoiceSingle,
          headline: label("Plan", "Tarif"),
          required: false,
          choices: [
            { id: "basic", label: label("Basic", "Einfach") },
            { id: "pro", label: label("Pro", "Profi") },
          ],
        },
        {
          id: "rank",
          type: TSurveyElementTypeEnum.Ranking,
          headline: label("Rank", "Rang"),
          required: false,
          choices: [
            { id: "price", label: label("Price", "Preis") },
            { id: "speed", label: label("Speed", "Tempo") },
          ],
        },
        {
          id: "grid",
          type: TSurveyElementTypeEnum.Matrix,
          headline: label("Rate", "Bewerten"),
          required: false,
          rows: [
            { id: "editor", label: label("Editor", "Bearbeiter") },
            { id: "export", label: label("Export", "Ausfuhr") },
          ],
          columns: [
            { id: "bad", label: label("Bad", "Schlecht") },
            { id: "good", label: label("Good", "Gut") },
          ],
        },
      ],
    },
  ],
  endings: [],
  variables: [],
  embeddedFields: [],
  languages: [],
} as unknown as TJsWorkspaceStateSurvey;

/** Answered in German, read in the response's language, English (`default`). */
export const answeredInGerman: TResponseData = {
  plan: "Profi",
  rank: ["Tempo", "Preis"],
  grid: { Bearbeiter: "Gut", Ausfuhr: "Schlecht" },
};

const group = (condition: Omit<TSingleCondition, "id">): TConditionGroup => ({
  id: "g",
  connector: "and",
  conditions: [{ id: "c", ...condition }],
});

export const pickedPro = group({
  leftOperand: { type: "element", value: "plan" },
  operator: "equals",
  rightOperand: { type: "static", value: "pro" },
});

export const rankedSpeed = group({
  leftOperand: { type: "element", value: "rank" },
  operator: "includesOneOf",
  rightOperand: { type: "static", value: ["speed"] },
});

/** Row "Editor" (position 0) answered with column "Good" (position 1). */
export const editorRatedGood = group({
  leftOperand: { type: "element", value: "grid", meta: { row: "0" } },
  operator: "equals",
  rightOperand: { type: "static", value: "1" },
});

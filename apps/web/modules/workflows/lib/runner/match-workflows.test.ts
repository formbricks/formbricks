import { describe, expect, test } from "vitest";
import type { TWorkflowExecutableDefinition } from "@formbricks/workflows";
import { type WorkflowMatchCandidate, matchWorkflowsForResponse } from "./match-workflows";

const SURVEY = "cm9zr4q7i000108l84gozfggr";
const OTHER_SURVEY = "cm9zr4q7i000108l84gozzzzz";
const ENDING_A = "cm9zr4q7i000108l84goze001";
const ENDING_B = "cm9zr4q7i000108l84goze002";

const makeCandidate = (
  workflowId: string,
  config: { surveyId: string; endingCardIds: string[] }
): WorkflowMatchCandidate => ({
  workflowId,
  publishedVersionId: `${workflowId}-v`,
  definition: {
    schemaVersion: 1,
    trigger: { id: "trigger", type: "trigger", triggerType: "response.completed", config },
    nodes: [],
    edges: [],
    entryNodeId: "trigger",
  } as TWorkflowExecutableDefinition,
});

describe("matchWorkflowsForResponse", () => {
  test("empty endingCardIds matches any ending of the same survey", () => {
    const candidate = makeCandidate("wf_any", { surveyId: SURVEY, endingCardIds: [] });
    const result = matchWorkflowsForResponse([candidate], { surveyId: SURVEY, endingId: ENDING_A });
    expect(result).toEqual([{ workflowId: "wf_any", publishedVersionId: "wf_any-v" }]);
  });

  test("specific endingCardIds match only when the reached ending is listed", () => {
    const candidate = makeCandidate("wf_specific", { surveyId: SURVEY, endingCardIds: [ENDING_A] });
    expect(matchWorkflowsForResponse([candidate], { surveyId: SURVEY, endingId: ENDING_A })).toHaveLength(1);
    expect(matchWorkflowsForResponse([candidate], { surveyId: SURVEY, endingId: ENDING_B })).toHaveLength(0);
  });

  test("does not match a different survey", () => {
    const candidate = makeCandidate("wf", { surveyId: OTHER_SURVEY, endingCardIds: [] });
    expect(matchWorkflowsForResponse([candidate], { surveyId: SURVEY, endingId: ENDING_A })).toHaveLength(0);
  });

  test("does not match a non-response.completed trigger (future trigger types)", () => {
    const candidate = makeCandidate("wf", { surveyId: SURVEY, endingCardIds: [] });
    // Force a different triggerType to exercise the guard (only response.completed exists today).
    (candidate.definition.trigger as { triggerType: string }).triggerType = "other.trigger";
    expect(matchWorkflowsForResponse([candidate], { surveyId: SURVEY, endingId: ENDING_A })).toHaveLength(0);
  });

  test("fans out to every matching workflow and skips the non-matching ones", () => {
    const candidates = [
      makeCandidate("wf_any", { surveyId: SURVEY, endingCardIds: [] }),
      makeCandidate("wf_hit", { surveyId: SURVEY, endingCardIds: [ENDING_A] }),
      makeCandidate("wf_miss", { surveyId: SURVEY, endingCardIds: [ENDING_B] }),
      makeCandidate("wf_other_survey", { surveyId: OTHER_SURVEY, endingCardIds: [] }),
    ];
    const result = matchWorkflowsForResponse(candidates, { surveyId: SURVEY, endingId: ENDING_A });
    expect(result.map((m) => m.workflowId)).toEqual(["wf_any", "wf_hit"]);
  });

  test("returns nothing for no candidates", () => {
    expect(matchWorkflowsForResponse([], { surveyId: SURVEY, endingId: ENDING_A })).toEqual([]);
  });

  test("does not match (and does not throw) a malformed definition with no trigger", () => {
    const candidate = {
      workflowId: "wf_bad",
      publishedVersionId: "v",
      definition: { schemaVersion: 1, nodes: [], edges: [] } as unknown as TWorkflowExecutableDefinition,
    };
    expect(matchWorkflowsForResponse([candidate], { surveyId: SURVEY, endingId: ENDING_A })).toEqual([]);
  });

  test("does not match (and does not throw) a trigger missing its config", () => {
    const candidate = {
      workflowId: "wf_bad",
      publishedVersionId: "v",
      definition: {
        schemaVersion: 1,
        trigger: { id: "t", type: "trigger", triggerType: "response.completed" },
        nodes: [],
        edges: [],
        entryNodeId: "t",
      } as unknown as TWorkflowExecutableDefinition,
    };
    expect(matchWorkflowsForResponse([candidate], { surveyId: SURVEY, endingId: ENDING_A })).toEqual([]);
  });

  test("a malformed candidate never blocks matching of a valid one", () => {
    const malformed = {
      workflowId: "wf_bad",
      publishedVersionId: "vb",
      definition: {} as unknown as TWorkflowExecutableDefinition,
    };
    const valid = makeCandidate("wf_ok", { surveyId: SURVEY, endingCardIds: [] });
    const result = matchWorkflowsForResponse([malformed, valid], { surveyId: SURVEY, endingId: ENDING_A });
    expect(result.map((m) => m.workflowId)).toEqual(["wf_ok"]);
  });
});

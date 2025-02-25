import { beforeEach, describe, expect, test } from "vitest";
import {
  mockDisplayId,
  mockQuestionId,
  mockQuestionId2,
  mockResponseId,
  mockSingleUseId,
  mockSurveyId,
  mockSurveyId2,
  mockUserId,
} from "./__mocks__/state.mock";
import { SurveyState } from "@/lib/survey/state";

describe("SurveyState", () => {
  let surveyState: SurveyState;

  beforeEach(() => {
    surveyState = new SurveyState(mockSurveyId);
  });

  describe("constructor", () => {
    test("initializes with required surveyId", () => {
      expect(surveyState.surveyId).toBe(mockSurveyId);
      expect(surveyState.responseId).toBeNull();
      expect(surveyState.userId).toBeNull();
      expect(surveyState.singleUseId).toBeNull();
    });

    test("initializes with all optional parameters", () => {
      const state = new SurveyState(mockSurveyId, mockSingleUseId, mockResponseId, mockUserId);
      expect(state.surveyId).toBe(mockSurveyId);
      expect(state.singleUseId).toBe(mockSingleUseId);
      expect(state.responseId).toBe(mockResponseId);
      expect(state.userId).toBe(mockUserId);
    });
  });

  describe("setSurveyId", () => {
    test("updates surveyId and clears state", () => {
      // First set some data
      surveyState.responseId = mockResponseId;
      surveyState.responseAcc = {
        finished: true,
        data: { [mockQuestionId]: "test" },
        ttc: { [mockQuestionId]: 5000 },
        variables: {},
      };

      // Then update survey ID
      surveyState.setSurveyId(mockSurveyId2);

      expect(surveyState.surveyId).toBe(mockSurveyId2);
      expect(surveyState.responseId).toBeNull();
      expect(surveyState.responseAcc).toEqual({ finished: false, data: {}, ttc: {}, variables: {} });
    });
  });

  describe("copy", () => {
    test("creates an exact copy of the state", () => {
      surveyState.responseId = mockResponseId;
      surveyState.userId = mockUserId;
      surveyState.singleUseId = mockSingleUseId;
      surveyState.responseAcc = {
        finished: true,
        data: { [mockQuestionId]: "answer1" },
        ttc: { [mockQuestionId]: 3000 },
        variables: { var1: "value1" },
      };

      const copy = surveyState.copy();

      expect(copy).toBeInstanceOf(SurveyState);
      expect(copy).not.toBe(surveyState); // Different instance
      expect(copy.surveyId).toBe(surveyState.surveyId);
      expect(copy.responseId).toBe(surveyState.responseId);
      expect(copy.userId).toBe(surveyState.userId);
      expect(copy.singleUseId).toBe(surveyState.singleUseId);
      expect(copy.responseAcc).toEqual(surveyState.responseAcc);
    });
  });

  describe("accumulateResponse", () => {
    test("accumulates response data correctly", () => {
      const firstUpdate = {
        finished: false,
        data: { [mockQuestionId]: "answer1" },
        ttc: { [mockQuestionId]: 3000 },
        variables: { var1: "value1" },
        displayId: mockDisplayId,
      };

      const secondUpdate = {
        finished: true,
        data: { [mockQuestionId2]: "answer2" },
        ttc: { [mockQuestionId2]: 2000 },
        variables: { var2: "value2" },
        displayId: mockDisplayId,
      };

      surveyState.accumulateResponse(firstUpdate);
      expect(surveyState.responseAcc.data).toEqual({ [mockQuestionId]: "answer1" });
      expect(surveyState.responseAcc.ttc).toEqual({ [mockQuestionId]: 3000 });
      expect(surveyState.responseAcc.variables).toEqual({ var1: "value1" });

      surveyState.accumulateResponse(secondUpdate);
      expect(surveyState.responseAcc.data).toEqual({
        [mockQuestionId]: "answer1",
        [mockQuestionId2]: "answer2",
      });
      expect(surveyState.responseAcc.ttc).toEqual({ [mockQuestionId2]: 2000 });
      expect(surveyState.responseAcc.variables).toEqual({ var2: "value2" });
      expect(surveyState.responseAcc.finished).toBe(true);
    });
  });

  describe("state management methods", () => {
    test("updateResponseId sets response ID", () => {
      surveyState.updateResponseId(mockResponseId);
      expect(surveyState.responseId).toBe(mockResponseId);
    });

    test("updateDisplayId sets display ID", () => {
      surveyState.updateDisplayId(mockDisplayId);
      expect(surveyState.displayId).toBe(mockDisplayId);
    });

    test("updateUserId sets user ID", () => {
      surveyState.updateUserId(mockUserId);
      expect(surveyState.userId).toBe(mockUserId);
    });

    test("isResponseFinished returns correct state", () => {
      expect(surveyState.isResponseFinished()).toBe(false);
      surveyState.responseAcc.finished = true;
      expect(surveyState.isResponseFinished()).toBe(true);
    });

    test("clear resets response state", () => {
      surveyState.responseId = mockResponseId;
      surveyState.responseAcc = {
        finished: true,
        data: { [mockQuestionId]: "test" },
        ttc: { [mockQuestionId]: 5000 },
        variables: { var1: "test" },
      };

      surveyState.clear();

      expect(surveyState.responseId).toBeNull();
      expect(surveyState.responseAcc).toEqual({
        finished: false,
        data: {},
        ttc: {},
        variables: {},
      });
    });
  });
});

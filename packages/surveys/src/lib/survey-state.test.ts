import { beforeEach, describe, expect, test } from "vitest";
import { TResponseUpdate } from "@formbricks/types/responses";
import { SurveyState } from "./survey-state";

describe("SurveyState", () => {
  let surveyState: SurveyState;
  const initialSurveyId = "survey1";

  beforeEach(() => {
    surveyState = new SurveyState(initialSurveyId);
  });

  test("should initialize with a surveyId and default values", () => {
    expect(surveyState.surveyId).toBe(initialSurveyId);
    expect(surveyState.responseId).toBeNull();
    expect(surveyState.displayId).toBeNull();
    expect(surveyState.userId).toBeNull();
    expect(surveyState.contactId).toBeNull();
    expect(surveyState.singleUseId).toBeNull();
    expect(surveyState.responseAcc).toEqual({ finished: false, data: {}, ttc: {}, variables: {} });
  });

  test("should initialize with all optional parameters", () => {
    const singleUseId = "singleUse123";
    const responseId = "response123";
    const userId = "user123";
    const contactId = "contact123";
    const stateWithOptions = new SurveyState(initialSurveyId, singleUseId, responseId, userId, contactId);
    expect(stateWithOptions.surveyId).toBe(initialSurveyId);
    expect(stateWithOptions.singleUseId).toBe(singleUseId);
    expect(stateWithOptions.responseId).toBe(responseId);
    expect(stateWithOptions.userId).toBe(userId);
    expect(stateWithOptions.contactId).toBe(contactId);
  });

  describe("setSurveyId", () => {
    test("should update surveyId and clear the state", () => {
      surveyState.responseId = "res1";
      surveyState.responseAcc = { finished: true, data: { q1: "ans1" }, ttc: { q1: 100 }, variables: {} };
      const newSurveyId = "survey2";
      surveyState.setSurveyId(newSurveyId);
      expect(surveyState.surveyId).toBe(newSurveyId);
      expect(surveyState.responseId).toBeNull();
      expect(surveyState.responseAcc).toEqual({ finished: false, data: {}, ttc: {}, variables: {} });
    });
  });

  describe("copy", () => {
    test("should create a deep copy of the survey state", () => {
      surveyState.responseId = "res123";
      surveyState.responseAcc = {
        finished: true,
        data: { q1: "a" },
        ttc: { q1: 100 },
        variables: { v1: "val1" },
      };
      surveyState.userId = "userTest";
      surveyState.contactId = "contactTest";
      surveyState.singleUseId = "singleUseTest";
      surveyState.displayId = "displayTest";

      const copiedState = surveyState.copy();

      expect(copiedState).not.toBe(surveyState); // Ensure it's a new instance
      expect(copiedState.surveyId).toBe(surveyState.surveyId);
      expect(copiedState.responseId).toBe(surveyState.responseId);
      expect(copiedState.displayId).toBeNull(); // displayId is not copied, so it remains null from constructor
      expect(copiedState.userId).toBe(surveyState.userId);
      expect(copiedState.contactId).toBe(surveyState.contactId);
      expect(copiedState.singleUseId).toBe(surveyState.singleUseId);
      expect(copiedState.responseAcc).toEqual(surveyState.responseAcc); // Checks for value equality
      expect(copiedState.responseAcc.data).toBe(surveyState.responseAcc.data);
      expect(copiedState.responseAcc.ttc).toBe(surveyState.responseAcc.ttc);
      expect(copiedState.responseAcc.variables).toBe(surveyState.responseAcc.variables);
    });

    test("should correctly copy when optional IDs are null", () => {
      // surveyState is in its initial state from beforeEach,
      // where singleUseId, responseId, userId, contactId are null.
      const copiedState = surveyState.copy();

      expect(copiedState.surveyId).toBe(initialSurveyId); // Sanity check for surveyId
      expect(copiedState.singleUseId).toBeNull();
      expect(copiedState.responseId).toBeNull();
      expect(copiedState.userId).toBeNull();
      expect(copiedState.contactId).toBeNull();
      expect(copiedState.displayId).toBeNull(); // displayId is not copied

      // Check responseAcc defaults as well
      expect(copiedState.responseAcc).toEqual({ finished: false, data: {}, ttc: {}, variables: {} });
    });
  });

  test("should update responseId", () => {
    const newResponseId = "res456";
    surveyState.updateResponseId(newResponseId);
    expect(surveyState.responseId).toBe(newResponseId);
  });

  test("should update displayId", () => {
    const newDisplayId = "disp789";
    surveyState.updateDisplayId(newDisplayId);
    expect(surveyState.displayId).toBe(newDisplayId);
  });

  test("should update userId", () => {
    const newUserId = "userXYZ";
    surveyState.updateUserId(newUserId);
    expect(surveyState.userId).toBe(newUserId);
  });

  test("should update contactId", () => {
    const newContactId = "contactABC";
    surveyState.updateContactId(newContactId);
    expect(surveyState.contactId).toBe(newContactId);
  });

  describe("accumulateResponse", () => {
    test("should accumulate response data correctly", () => {
      const initialResponse: TResponseUpdate = {
        finished: false,
        data: { q1: "ans1" },
        ttc: { q1: 100 },
        variables: { varA: "valA" },
      };
      surveyState.accumulateResponse(initialResponse);
      expect(surveyState.responseAcc).toEqual(initialResponse);

      const additionalResponse: TResponseUpdate = {
        finished: true,
        data: { q2: "ans2", q1: "newAns1" }, // q1 should be overwritten
        ttc: { q2: 200 },
        variables: { varB: "valB" }, // variables should be overwritten, not merged by default class behavior
        displayId: "display123",
      };
      surveyState.accumulateResponse(additionalResponse);

      expect(surveyState.responseAcc.finished).toBe(true);
      expect(surveyState.responseAcc.data).toEqual({ q1: "newAns1", q2: "ans2" });
      expect(surveyState.responseAcc.ttc).toEqual({ q2: 200 }); // ttc is overwritten
      expect(surveyState.responseAcc.variables).toEqual({ varB: "valB" }); // variables are overwritten
      expect(surveyState.responseAcc.displayId).toBe("display123");
    });
  });

  describe("isResponseFinished", () => {
    test("should return true if responseAcc.finished is true", () => {
      surveyState.responseAcc.finished = true;
      expect(surveyState.isResponseFinished()).toBe(true);
    });

    test("should return false if responseAcc.finished is false", () => {
      surveyState.responseAcc.finished = false;
      expect(surveyState.isResponseFinished()).toBe(false);
    });
  });

  describe("clear", () => {
    test("should reset responseId and responseAcc", () => {
      surveyState.responseId = "someId";
      surveyState.responseAcc = { finished: true, data: { q: "a" }, ttc: { q: 1 }, variables: { v: "1" } };
      surveyState.clear();
      expect(surveyState.responseId).toBeNull();
      expect(surveyState.responseAcc).toEqual({ finished: false, data: {}, ttc: {}, variables: {} });
    });
  });
});

import { convertResponseValue } from "@/lib/responses";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  TWeeklyEmailResponseData,
  TWeeklySummaryEnvironmentData,
  TWeeklySummarySurveyData,
} from "@formbricks/types/weekly-summary";
import { getNotificationResponse } from "./notificationResponse";

vi.mock("@/lib/responses", () => ({
  convertResponseValue: vi.fn(),
}));

vi.mock("@/lib/utils/recall", () => ({
  replaceHeadlineRecall: vi.fn((survey) => survey),
}));

describe("getNotificationResponse", () => {
  afterEach(() => {
    cleanup();
  });

  test("should return a notification response with calculated insights and survey data when provided with an environment containing multiple surveys", () => {
    const mockSurveys = [
      {
        id: "survey1",
        name: "Survey 1",
        status: "inProgress",
        questions: [
          {
            id: "question1",
            headline: { default: "Question 1" },
            type: "text",
          } as unknown as TSurveyQuestion,
        ],
        displays: [{ id: "display1" }],
        responses: [
          { id: "response1", finished: true, data: { question1: "Answer 1" } },
          { id: "response2", finished: false, data: { question1: "Answer 2" } },
        ],
      } as unknown as TSurvey & { responses: TWeeklyEmailResponseData[] },
      {
        id: "survey2",
        name: "Survey 2",
        status: "inProgress",
        questions: [
          {
            id: "question2",
            headline: { default: "Question 2" },
            type: "text",
          } as unknown as TSurveyQuestion,
        ],
        displays: [{ id: "display2" }],
        responses: [
          { id: "response3", finished: true, data: { question2: "Answer 3" } },
          { id: "response4", finished: true, data: { question2: "Answer 4" } },
          { id: "response5", finished: false, data: { question2: "Answer 5" } },
        ],
      } as unknown as TSurvey & { responses: TWeeklyEmailResponseData[] },
    ] as unknown as TWeeklySummarySurveyData[];

    const mockEnvironment = {
      id: "env1",
      surveys: mockSurveys,
    } as unknown as TWeeklySummaryEnvironmentData;

    const projectName = "Project Name";

    const notificationResponse = getNotificationResponse(mockEnvironment, projectName);

    expect(notificationResponse).toBeDefined();
    expect(notificationResponse.environmentId).toBe("env1");
    expect(notificationResponse.projectName).toBe(projectName);
    expect(notificationResponse.surveys).toHaveLength(2);

    expect(notificationResponse.insights.totalCompletedResponses).toBe(3);
    expect(notificationResponse.insights.totalDisplays).toBe(2);
    expect(notificationResponse.insights.totalResponses).toBe(5);
    expect(notificationResponse.insights.completionRate).toBe(60);
    expect(notificationResponse.insights.numLiveSurvey).toBe(2);

    expect(notificationResponse.surveys[0].id).toBe("survey1");
    expect(notificationResponse.surveys[0].name).toBe("Survey 1");
    expect(notificationResponse.surveys[0].status).toBe("inProgress");
    expect(notificationResponse.surveys[0].responseCount).toBe(2);

    expect(notificationResponse.surveys[1].id).toBe("survey2");
    expect(notificationResponse.surveys[1].name).toBe("Survey 2");
    expect(notificationResponse.surveys[1].status).toBe("inProgress");
    expect(notificationResponse.surveys[1].responseCount).toBe(3);
  });

  test("should calculate the correct completion rate and other insights when surveys have responses with varying statuses", () => {
    const mockSurveys = [
      {
        id: "survey1",
        name: "Survey 1",
        status: "inProgress",
        questions: [
          {
            id: "question1",
            headline: { default: "Question 1" },
            type: "text",
          } as unknown as TSurveyQuestion,
        ],
        displays: [{ id: "display1" }],
        responses: [
          { id: "response1", finished: true, data: { question1: "Answer 1" } },
          { id: "response2", finished: false, data: { question1: "Answer 2" } },
        ],
      } as unknown as TSurvey & { responses: TWeeklyEmailResponseData[] },
      {
        id: "survey2",
        name: "Survey 2",
        status: "inProgress",
        questions: [
          {
            id: "question2",
            headline: { default: "Question 2" },
            type: "text",
          } as unknown as TSurveyQuestion,
        ],
        displays: [{ id: "display2" }],
        responses: [
          { id: "response3", finished: true, data: { question2: "Answer 3" } },
          { id: "response4", finished: true, data: { question2: "Answer 4" } },
          { id: "response5", finished: false, data: { question2: "Answer 5" } },
        ],
      } as unknown as TSurvey & { responses: TWeeklyEmailResponseData[] },
      {
        id: "survey3",
        name: "Survey 3",
        status: "inProgress",
        questions: [
          {
            id: "question3",
            headline: { default: "Question 3" },
            type: "text",
          } as unknown as TSurveyQuestion,
        ],
        displays: [{ id: "display3" }],
        responses: [{ id: "response6", finished: false, data: { question3: "Answer 6" } }],
      } as unknown as TSurvey & { responses: TWeeklyEmailResponseData[] },
    ] as unknown as TWeeklySummarySurveyData[];

    const mockEnvironment = {
      id: "env1",
      surveys: mockSurveys,
    } as unknown as TWeeklySummaryEnvironmentData;

    const projectName = "Project Name";

    const notificationResponse = getNotificationResponse(mockEnvironment, projectName);

    expect(notificationResponse).toBeDefined();
    expect(notificationResponse.environmentId).toBe("env1");
    expect(notificationResponse.projectName).toBe(projectName);
    expect(notificationResponse.surveys).toHaveLength(3);

    expect(notificationResponse.insights.totalCompletedResponses).toBe(3);
    expect(notificationResponse.insights.totalDisplays).toBe(3);
    expect(notificationResponse.insights.totalResponses).toBe(6);
    expect(notificationResponse.insights.completionRate).toBe(50);
    expect(notificationResponse.insights.numLiveSurvey).toBe(3);

    expect(notificationResponse.surveys[0].id).toBe("survey1");
    expect(notificationResponse.surveys[0].name).toBe("Survey 1");
    expect(notificationResponse.surveys[0].status).toBe("inProgress");
    expect(notificationResponse.surveys[0].responseCount).toBe(2);

    expect(notificationResponse.surveys[1].id).toBe("survey2");
    expect(notificationResponse.surveys[1].name).toBe("Survey 2");
    expect(notificationResponse.surveys[1].status).toBe("inProgress");
    expect(notificationResponse.surveys[1].responseCount).toBe(3);

    expect(notificationResponse.surveys[2].id).toBe("survey3");
    expect(notificationResponse.surveys[2].name).toBe("Survey 3");
    expect(notificationResponse.surveys[2].status).toBe("inProgress");
    expect(notificationResponse.surveys[2].responseCount).toBe(1);
  });

  test("should return default insights and an empty surveys array when the environment contains no surveys", () => {
    const mockEnvironment = {
      id: "env1",
      surveys: [],
    } as unknown as TWeeklySummaryEnvironmentData;

    const projectName = "Project Name";

    const notificationResponse = getNotificationResponse(mockEnvironment, projectName);

    expect(notificationResponse).toBeDefined();
    expect(notificationResponse.environmentId).toBe("env1");
    expect(notificationResponse.projectName).toBe(projectName);
    expect(notificationResponse.surveys).toHaveLength(0);

    expect(notificationResponse.insights.totalCompletedResponses).toBe(0);
    expect(notificationResponse.insights.totalDisplays).toBe(0);
    expect(notificationResponse.insights.totalResponses).toBe(0);
    expect(notificationResponse.insights.completionRate).toBe(0);
    expect(notificationResponse.insights.numLiveSurvey).toBe(0);
  });

  test("should handle missing response data gracefully when a response doesn't contain data for a question ID", () => {
    const mockSurveys = [
      {
        id: "survey1",
        name: "Survey 1",
        status: "inProgress",
        questions: [
          {
            id: "question1",
            headline: { default: "Question 1" },
            type: "text",
          } as unknown as TSurveyQuestion,
        ],
        displays: [{ id: "display1" }],
        responses: [
          { id: "response1", finished: true, data: {} }, // Response missing data for question1
        ],
      } as unknown as TSurvey & { responses: TWeeklyEmailResponseData[] },
    ] as unknown as TWeeklySummarySurveyData[];

    const mockEnvironment = {
      id: "env1",
      surveys: mockSurveys,
    } as unknown as TWeeklySummaryEnvironmentData;

    const projectName = "Project Name";

    // Mock the convertResponseValue function to handle the missing data case
    vi.mocked(convertResponseValue).mockReturnValue("");

    const notificationResponse = getNotificationResponse(mockEnvironment, projectName);

    expect(notificationResponse).toBeDefined();
    expect(notificationResponse.surveys).toHaveLength(1);
    expect(notificationResponse.surveys[0].responses).toHaveLength(1);
    expect(notificationResponse.surveys[0].responses[0].responseValue).toBe("");
  });

  test("should handle unsupported question types gracefully", () => {
    const mockSurveys = [
      {
        id: "survey1",
        name: "Survey 1",
        status: "inProgress",
        questions: [
          {
            id: "question1",
            headline: { default: "Question 1" },
            type: "unsupported",
          } as unknown as TSurveyQuestion,
        ],
        displays: [{ id: "display1" }],
        responses: [{ id: "response1", finished: true, data: { question1: "Answer 1" } }],
      } as unknown as TSurvey & { responses: TWeeklyEmailResponseData[] },
    ] as unknown as TWeeklySummarySurveyData[];

    const mockEnvironment = {
      id: "env1",
      surveys: mockSurveys,
    } as unknown as TWeeklySummaryEnvironmentData;

    const projectName = "Project Name";

    vi.mocked(convertResponseValue).mockReturnValue("Unsupported Response");

    const notificationResponse = getNotificationResponse(mockEnvironment, projectName);

    expect(notificationResponse).toBeDefined();
    expect(notificationResponse.surveys[0].responses[0].responseValue).toBe("Unsupported Response");
  });
});

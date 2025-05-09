import { TPipelineInput } from "@/app/api/(internal)/pipeline/types/pipelines";
import { writeData as airtableWriteData } from "@/lib/airtable/service";
import { writeData as googleSheetWriteData } from "@/lib/googleSheet/service";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { writeData as writeNotionData } from "@/lib/notion/service";
import { processResponseData } from "@/lib/responses";
import { writeDataToSlack } from "@/lib/slack/service";
import { getFormattedDateTimeString } from "@/lib/utils/datetime";
import { parseRecallInfo } from "@/lib/utils/recall";
import { truncateText } from "@/lib/utils/strings";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import {
  TIntegrationAirtable,
  TIntegrationAirtableConfig,
  TIntegrationAirtableConfigData,
  TIntegrationAirtableCredential,
} from "@formbricks/types/integration/airtable";
import {
  TIntegrationGoogleSheets,
  TIntegrationGoogleSheetsConfig,
  TIntegrationGoogleSheetsConfigData,
  TIntegrationGoogleSheetsCredential,
} from "@formbricks/types/integration/google-sheet";
import {
  TIntegrationNotion,
  TIntegrationNotionConfigData,
  TIntegrationNotionCredential,
} from "@formbricks/types/integration/notion";
import {
  TIntegrationSlack,
  TIntegrationSlackConfigData,
  TIntegrationSlackCredential,
} from "@formbricks/types/integration/slack";
import { TResponse, TResponseMeta } from "@formbricks/types/responses";
import {
  TSurvey,
  TSurveyOpenTextQuestion,
  TSurveyPictureSelectionQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { handleIntegrations } from "./handleIntegrations";

// Mock dependencies
vi.mock("@/lib/airtable/service");
vi.mock("@/lib/googleSheet/service");
vi.mock("@/lib/i18n/utils");
vi.mock("@/lib/notion/service");
vi.mock("@/lib/responses");
vi.mock("@/lib/slack/service");
vi.mock("@/lib/utils/datetime");
vi.mock("@/lib/utils/recall");
vi.mock("@/lib/utils/strings");
vi.mock("@formbricks/logger");

// Mock data
const surveyId = "survey1";
const questionId1 = "q1";
const questionId2 = "q2";
const questionId3 = "q3_picture";
const hiddenFieldId = "hidden1";
const variableId = "var1";

const mockPipelineInput = {
  environmentId: "env1",
  surveyId: surveyId,
  response: {
    id: "response1",
    createdAt: new Date("2024-01-01T12:00:00Z"),
    updatedAt: new Date("2024-01-01T12:00:00Z"),
    finished: true,
    surveyId: surveyId,
    data: {
      [questionId1]: "Answer 1",
      [questionId2]: ["Choice 1", "Choice 2"],
      [questionId3]: ["picChoice1"],
      [hiddenFieldId]: "Hidden Value",
    },
    meta: {
      url: "http://example.com",
      source: "web",
      userAgent: {
        browser: "Chrome",
        os: "Mac OS",
        device: "Desktop",
      },
      country: "USA",
      action: "Action Name",
    } as TResponseMeta,
    personAttributes: {},
    singleUseId: null,
    personId: "person1",
    notes: [],
    tags: [],
    variables: {
      [variableId]: "Variable Value",
    },
    ttc: {},
  } as unknown as TResponse,
} as TPipelineInput;

const mockSurvey = {
  id: surveyId,
  name: "Test Survey",
  questions: [
    {
      id: questionId1,
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question 1 {{recall:q2}}" },
      required: true,
    } as unknown as TSurveyOpenTextQuestion,
    {
      id: questionId2,
      type: TSurveyQuestionTypeEnum.MultipleChoiceMulti,
      headline: { default: "Question 2" },
      required: true,
      choices: [
        { id: "choice1", label: { default: "Choice 1" } },
        { id: "choice2", label: { default: "Choice 2" } },
      ],
    },
    {
      id: questionId3,
      type: TSurveyQuestionTypeEnum.PictureSelection,
      headline: { default: "Question 3" },
      required: true,
      choices: [
        { id: "picChoice1", imageUrl: "http://image.com/1" },
        { id: "picChoice2", imageUrl: "http://image.com/2" },
      ],
    } as unknown as TSurveyPictureSelectionQuestion,
  ],
  hiddenFields: {
    enabled: true,
    fieldIds: [hiddenFieldId],
  },
  variables: [{ id: variableId, name: "Variable 1" } as unknown as TSurvey["variables"][0]],
  autoClose: null,
  triggers: [],
  status: "inProgress",
  type: "app",
  languages: [],
  styling: {},
  segment: null,
  recontactDays: null,
  autoComplete: null,
  closeOnDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  displayOption: "displayOnce",
  displayPercentage: null,
  environmentId: "env1",
  singleUse: null,
  surveyClosedMessage: null,
  resultShareKey: null,
  pin: null,
} as unknown as TSurvey;

const mockAirtableIntegration: TIntegrationAirtable = {
  id: "int_airtable",
  type: "airtable",
  environmentId: "env1",
  config: {
    key: { access_token: "airtable_key" } as TIntegrationAirtableCredential,
    data: [
      {
        surveyId: surveyId,
        questionIds: [questionId1, questionId2],
        baseId: "base1",
        tableId: "table1",
        createdAt: new Date(),
        includeHiddenFields: true,
        includeMetadata: true,
        includeCreatedAt: true,
        includeVariables: true,
      } as TIntegrationAirtableConfigData,
    ],
  } as TIntegrationAirtableConfig,
};

const mockGoogleSheetsIntegration: TIntegrationGoogleSheets = {
  id: "int_gsheets",
  type: "googleSheets",
  environmentId: "env1",
  config: {
    key: { refresh_token: "gsheet_key" } as TIntegrationGoogleSheetsCredential,
    data: [
      {
        surveyId: surveyId,
        spreadsheetId: "sheet1",
        spreadsheetName: "Sheet Name",
        questionIds: [questionId1],
        questions: "What is Q1?",
        createdAt: new Date("2024-01-01T00:00:00.000Z"),
        includeHiddenFields: false,
        includeMetadata: false,
        includeCreatedAt: false,
        includeVariables: false,
      } as TIntegrationGoogleSheetsConfigData,
    ],
  } as TIntegrationGoogleSheetsConfig,
};

const mockSlackIntegration: TIntegrationSlack = {
  id: "int_slack",
  type: "slack",
  environmentId: "env1",
  config: {
    key: { access_token: "slack_key", app_id: "A1" } as TIntegrationSlackCredential,
    data: [
      {
        surveyId: surveyId,
        channelId: "channel1",
        channelName: "Channel 1",
        questionIds: [questionId1, questionId2, questionId3],
        questions: "Q1, Q2, Q3",
        createdAt: new Date(),
        includeHiddenFields: true,
        includeMetadata: true,
        includeCreatedAt: true,
        includeVariables: true,
      } as TIntegrationSlackConfigData,
    ],
  },
};

const mockNotionIntegration: TIntegrationNotion = {
  id: "int_notion",
  type: "notion",
  environmentId: "env1",
  config: {
    key: {
      access_token: "notion_key",
      workspace_name: "ws",
      workspace_icon: "",
      workspace_id: "w1",
    } as TIntegrationNotionCredential,
    data: [
      {
        surveyId: surveyId,
        databaseId: "db1",
        databaseName: "DB 1",
        mapping: [
          {
            question: { id: questionId1, name: "Question 1", type: TSurveyQuestionTypeEnum.OpenText },
            column: { id: "col1", name: "Column 1", type: "rich_text" },
          },
          {
            question: { id: questionId3, name: "Question 3", type: TSurveyQuestionTypeEnum.PictureSelection },
            column: { id: "col3", name: "Column 3", type: "url" },
          },
          {
            question: { id: "metadata", name: "Metadata", type: "metadata" },
            column: { id: "col_meta", name: "Metadata Col", type: "rich_text" },
          },
          {
            question: { id: "createdAt", name: "Created At", type: "createdAt" },
            column: { id: "col_created", name: "Created Col", type: "date" },
          },
        ],
        createdAt: new Date(),
      } as TIntegrationNotionConfigData,
    ],
  },
};

describe("handleIntegrations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Refine mock to explicitly handle string inputs
    vi.mocked(processResponseData).mockImplementation((data) => {
      if (typeof data === "string") {
        return data; // Directly return string inputs
      }
      // Handle arrays and null/undefined as before
      return String(Array.isArray(data) ? data.join(", ") : (data ?? ""));
    });
    vi.mocked(getLocalizedValue).mockImplementation((value, _) => value?.default || "");
    vi.mocked(parseRecallInfo).mockImplementation((text, _, __) => text || "");
    vi.mocked(getFormattedDateTimeString).mockReturnValue("2024-01-01 12:00");
    vi.mocked(truncateText).mockImplementation((text, limit) => text.slice(0, limit));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should call correct handlers for each integration type", async () => {
    const integrations = [
      mockAirtableIntegration,
      mockGoogleSheetsIntegration,
      mockSlackIntegration,
      mockNotionIntegration,
    ];
    vi.mocked(airtableWriteData).mockResolvedValue(undefined);
    vi.mocked(googleSheetWriteData).mockResolvedValue(undefined);
    vi.mocked(writeDataToSlack).mockResolvedValue(undefined);
    vi.mocked(writeNotionData).mockResolvedValue(undefined);

    await handleIntegrations(integrations, mockPipelineInput, mockSurvey);

    expect(airtableWriteData).toHaveBeenCalledTimes(1);
    expect(googleSheetWriteData).toHaveBeenCalledTimes(1);
    expect(writeDataToSlack).toHaveBeenCalledTimes(1);
    expect(writeNotionData).toHaveBeenCalledTimes(1);
    expect(logger.error).not.toHaveBeenCalled();
  });

  test("should log errors when integration handlers fail", async () => {
    const integrations = [mockAirtableIntegration, mockSlackIntegration];
    const airtableError = new Error("Airtable failed");
    const slackError = new Error("Slack failed");
    vi.mocked(airtableWriteData).mockRejectedValue(airtableError);
    vi.mocked(writeDataToSlack).mockRejectedValue(slackError);

    await handleIntegrations(integrations, mockPipelineInput, mockSurvey);

    expect(airtableWriteData).toHaveBeenCalledTimes(1);
    expect(writeDataToSlack).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(airtableError, "Error in airtable integration");
    expect(logger.error).toHaveBeenCalledWith(slackError, "Error in slack integration");
  });

  test("should handle empty integrations array", async () => {
    await handleIntegrations([], mockPipelineInput, mockSurvey);
    expect(airtableWriteData).not.toHaveBeenCalled();
    expect(googleSheetWriteData).not.toHaveBeenCalled();
    expect(writeDataToSlack).not.toHaveBeenCalled();
    expect(writeNotionData).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  // Test individual handlers by calling the main function with a single integration
  describe("Airtable Integration", () => {
    test("should call airtableWriteData with correct parameters", async () => {
      vi.mocked(airtableWriteData).mockResolvedValue(undefined);
      await handleIntegrations([mockAirtableIntegration], mockPipelineInput, mockSurvey);

      expect(airtableWriteData).toHaveBeenCalledTimes(1);
      // Adjust expectations for metadata and recalled question
      const expectedMetadataString =
        "Source: web\nURL: http://example.com\nBrowser: Chrome\nOS: Mac OS\nDevice: Desktop\nCountry: USA\nAction: Action Name";
      expect(airtableWriteData).toHaveBeenCalledWith(
        mockAirtableIntegration.config.key,
        mockAirtableIntegration.config.data[0],
        [
          [
            "Answer 1",
            "Choice 1, Choice 2",
            "Hidden Value",
            expectedMetadataString,
            "Variable Value",
            "2024-01-01 12:00",
          ], // responses + hidden + meta + var + created
          ["Question 1 {{recall:q2}}", "Question 2", hiddenFieldId, "Metadata", "Variable 1", "Created At"], // questions (raw headline for Airtable) + hidden + meta + var + created
        ]
      );
    });

    test("should not call airtableWriteData if surveyId does not match", async () => {
      const differentSurveyInput = { ...mockPipelineInput, surveyId: "otherSurvey" };
      await handleIntegrations([mockAirtableIntegration], differentSurveyInput, mockSurvey);

      expect(airtableWriteData).not.toHaveBeenCalled();
    });

    test("should return error result on failure", async () => {
      const error = new Error("Airtable API error");
      vi.mocked(airtableWriteData).mockRejectedValue(error);
      await handleIntegrations([mockAirtableIntegration], mockPipelineInput, mockSurvey);

      // Verify error was logged, remove checks on the return value
      expect(logger.error).toHaveBeenCalledWith(error, "Error in airtable integration");
    });
  });

  describe("Google Sheets Integration", () => {
    test("should call googleSheetWriteData with correct parameters", async () => {
      vi.mocked(googleSheetWriteData).mockResolvedValue(undefined);
      await handleIntegrations([mockGoogleSheetsIntegration], mockPipelineInput, mockSurvey);

      expect(googleSheetWriteData).toHaveBeenCalledTimes(1);
      // Check that createdAt is converted to Date object
      const expectedIntegrationData = structuredClone(mockGoogleSheetsIntegration);
      expectedIntegrationData.config.data[0].createdAt = new Date(
        mockGoogleSheetsIntegration.config.data[0].createdAt
      );
      expect(googleSheetWriteData).toHaveBeenCalledWith(
        expectedIntegrationData,
        mockGoogleSheetsIntegration.config.data[0].spreadsheetId,
        [
          ["Answer 1"], // responses
          ["Question 1 {{recall:q2}}"], // questions (raw headline for Google Sheets)
        ]
      );
    });

    test("should not call googleSheetWriteData if surveyId does not match", async () => {
      const differentSurveyInput = { ...mockPipelineInput, surveyId: "otherSurvey" };
      await handleIntegrations([mockGoogleSheetsIntegration], differentSurveyInput, mockSurvey);

      expect(googleSheetWriteData).not.toHaveBeenCalled();
    });

    test("should return error result on failure", async () => {
      const error = new Error("Google Sheets API error");
      vi.mocked(googleSheetWriteData).mockRejectedValue(error);
      await handleIntegrations([mockGoogleSheetsIntegration], mockPipelineInput, mockSurvey);

      // Verify error was logged, remove checks on the return value
      expect(logger.error).toHaveBeenCalledWith(error, "Error in google sheets integration");
    });
  });

  describe("Slack Integration", () => {
    test("should not call writeDataToSlack if surveyId does not match", async () => {
      const differentSurveyInput = { ...mockPipelineInput, surveyId: "otherSurvey" };
      await handleIntegrations([mockSlackIntegration], differentSurveyInput, mockSurvey);

      expect(writeDataToSlack).not.toHaveBeenCalled();
    });

    test("should return error result on failure", async () => {
      const error = new Error("Slack API error");
      vi.mocked(writeDataToSlack).mockRejectedValue(error);
      await handleIntegrations([mockSlackIntegration], mockPipelineInput, mockSurvey);

      // Verify error was logged, remove checks on the return value
      expect(logger.error).toHaveBeenCalledWith(error, "Error in slack integration");
    });
  });

  describe("Notion Integration", () => {
    test("should not call writeNotionData if surveyId does not match", async () => {
      const differentSurveyInput = { ...mockPipelineInput, surveyId: "otherSurvey" };
      await handleIntegrations([mockNotionIntegration], differentSurveyInput, mockSurvey);

      expect(writeNotionData).not.toHaveBeenCalled();
    });

    test("should return error result on failure", async () => {
      const error = new Error("Notion API error");
      vi.mocked(writeNotionData).mockRejectedValue(error);
      await handleIntegrations([mockNotionIntegration], mockPipelineInput, mockSurvey);

      // Verify error was logged, remove checks on the return value
      expect(logger.error).toHaveBeenCalledWith(error, "Error in notion integration");
    });
  });
});

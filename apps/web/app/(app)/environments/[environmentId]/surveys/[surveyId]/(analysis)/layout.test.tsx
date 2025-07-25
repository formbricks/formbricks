import { getResponseCountBySurveyId } from "@/lib/response/service";
import { getSurvey } from "@/lib/survey/service";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { cleanup, render, screen } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import SurveyLayout, { generateMetadata } from "./layout";

vi.mock("@/lib/response/service", () => ({
  getResponseCountBySurveyId: vi.fn(),
}));

vi.mock("@/lib/survey/service", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

const mockSurveyId = "survey_123";
const mockEnvironmentId = "env_456";
const mockSurveyName = "Test Survey";
const mockResponseCount = 10;

const mockSurvey = {
  id: mockSurveyId,
  name: mockSurveyName,
  questions: [],
  endings: [],
  status: "inProgress",
  type: "app",
  environmentId: mockEnvironmentId,
  welcomeCard: { enabled: false } as unknown as TSurvey["welcomeCard"],
  variables: [],
  triggers: [],
  styling: null,
  languages: [],
  segment: null,
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  displayLimit: null,
  displayOption: "displayOnce",
  isBackButtonHidden: false,
  pin: null,
  recontactDays: null,
  runOnDate: null,
  showLanguageSwitch: false,
  singleUse: null,
  surveyClosedMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  autoComplete: null,
  hiddenFields: { enabled: false, fieldIds: [] },
} as unknown as TSurvey;

describe("SurveyLayout", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  describe("generateMetadata", () => {
    test("should return correct metadata when session and survey exist", async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user_test_id" } });
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(getResponseCountBySurveyId).mockResolvedValue(mockResponseCount);

      const metadata = await generateMetadata({
        params: Promise.resolve({ surveyId: mockSurveyId, environmentId: mockEnvironmentId }),
      });

      expect(metadata).toEqual({
        title: `${mockResponseCount} Responses | ${mockSurveyName} Results`,
      });
      expect(getServerSession).toHaveBeenCalledWith(authOptions);
      expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
      expect(getResponseCountBySurveyId).toHaveBeenCalledWith(mockSurveyId);
    });

    test("should return correct metadata when survey is null", async () => {
      vi.mocked(getServerSession).mockResolvedValue({ user: { id: "user_test_id" } });
      vi.mocked(getSurvey).mockResolvedValue(null);
      vi.mocked(getResponseCountBySurveyId).mockResolvedValue(mockResponseCount);

      const metadata = await generateMetadata({
        params: Promise.resolve({ surveyId: mockSurveyId, environmentId: mockEnvironmentId }),
      });

      expect(metadata).toEqual({
        title: `${mockResponseCount} Responses | undefined Results`,
      });
    });

    test("should return empty title when session does not exist", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);
      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(getResponseCountBySurveyId).mockResolvedValue(mockResponseCount);

      const metadata = await generateMetadata({
        params: Promise.resolve({ surveyId: mockSurveyId, environmentId: mockEnvironmentId }),
      });

      expect(metadata).toEqual({
        title: "",
      });
    });
  });

  describe("SurveyLayout Component", () => {
    test("should render children", async () => {
      const childText = "Test Child Component";
      render(await SurveyLayout({ children: <div>{childText}</div> }));
      expect(screen.getByText(childText)).toBeInTheDocument();
    });
  });
});

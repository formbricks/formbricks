import { ShareSurveyLink } from "@/modules/analysis/components/ShareSurveyLink/index";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { toast } from "react-hot-toast";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
  },
}));

const survey: TSurvey = {
  id: "survey-id",
  name: "Test Survey",
  type: "link",
  status: "inProgress",
  questions: [
    {
      id: "question-id",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Question headline" },
      subheader: { default: "Question subheader" },
      required: true,
      buttonLabel: { default: "Next" },
      inputType: "text",
      charLimit: { enabled: false },
    },
  ],
  recontactDays: 1,
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  displayPercentage: null,
  displayLimit: null,
  triggers: [],
  redirectUrl: null,
  numDisplays: 0,
  numDisplaysGlobally: 0,
  numResponses: 0,
  numResponsesGlobally: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  languages: [
    {
      default: true,
      enabled: true,
      language: {
        id: "lang-1",
        code: "en",
        alias: "English",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "proj-1",
      },
    },
    {
      default: false,
      enabled: true,
      language: {
        id: "lang-2",
        code: "de",
        alias: "German",
        createdAt: new Date(),
        updatedAt: new Date(),
        projectId: "proj-1",
      },
    },
  ],
  styling: null,
  variables: [],
  welcomeCard: {
    enabled: true,
    headline: { default: "Welcome!" },
    timeToFinish: false,
    showResponseCount: false,
  },
  surveyClosedMessage: null,
  singleUse: null,
  productOverwrites: null,
  resultShareKey: null,
  pin: null,
  verifyEmail: null,
  attributeFilters: [],
  autoComplete: null,
  hiddenFields: { enabled: true },
  environmentId: "env-id",
  endings: [],
  displayOption: "displayOnce",
  isBackButtonHidden: false,
  isSingleResponsePerEmailEnabled: false,
  isVerifyEmailEnabled: false,
  recaptcha: { enabled: false, threshold: 0.5 },
  segment: null,
  showLanguageSwitch: false,
  createdBy: "user-id",
  followUps: [],
} as unknown as TSurvey;

const publicDomain = "http://localhost:3000";
let surveyUrl = `${publicDomain}/s/survey-id`;
const setSurveyUrl = vi.fn((url: string) => {
  surveyUrl = url;
});
const locale: TUserLocale = "en-US";

// Mocking dependencies
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => key,
  }),
}));

Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(),
  },
});

global.open = vi.fn();

describe("ShareSurveyLink", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    surveyUrl = `${publicDomain}/s/survey-id`;
  });

  test("renders the component with initial values", () => {
    render(
      <ShareSurveyLink
        survey={survey}
        publicDomain={publicDomain}
        surveyUrl={surveyUrl}
        setSurveyUrl={setSurveyUrl}
        locale={locale}
      />
    );

    expect(screen.getByDisplayValue(surveyUrl)).toBeInTheDocument();
    expect(screen.getByText("common.copy")).toBeInTheDocument();
    expect(screen.getByText("common.preview")).toBeInTheDocument();
  });

  test("copies the survey link to the clipboard when copy button is clicked", () => {
    render(
      <ShareSurveyLink
        survey={survey}
        publicDomain={publicDomain}
        surveyUrl={surveyUrl}
        setSurveyUrl={setSurveyUrl}
        locale={locale}
      />
    );

    const copyButton = screen.getByLabelText("environments.surveys.copy_survey_link_to_clipboard");
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(surveyUrl);
    expect(toast.success).toHaveBeenCalledWith("common.copied_to_clipboard");
  });

  test("opens the preview link in a new tab when preview button is clicked (no query params)", () => {
    render(
      <ShareSurveyLink
        survey={survey}
        publicDomain={publicDomain}
        surveyUrl={surveyUrl}
        setSurveyUrl={setSurveyUrl}
        locale={locale}
      />
    );

    const previewButton = screen.getByLabelText("environments.surveys.preview_survey_in_a_new_tab");
    fireEvent.click(previewButton);

    expect(global.open).toHaveBeenCalledWith(`${surveyUrl}?preview=true`, "_blank");
  });

  test("opens the preview link in a new tab when preview button is clicked (with query params)", () => {
    const surveyWithParamsUrl = `${publicDomain}/s/survey-id?foo=bar`;
    render(
      <ShareSurveyLink
        survey={survey}
        publicDomain={publicDomain}
        surveyUrl={surveyWithParamsUrl}
        setSurveyUrl={setSurveyUrl}
        locale={locale}
      />
    );

    const previewButton = screen.getByLabelText("environments.surveys.preview_survey_in_a_new_tab");
    fireEvent.click(previewButton);

    expect(global.open).toHaveBeenCalledWith(`${surveyWithParamsUrl}&preview=true`, "_blank");
  });

  test("disables copy and preview buttons when surveyUrl is empty", () => {
    render(
      <ShareSurveyLink
        survey={survey}
        publicDomain={publicDomain}
        surveyUrl=""
        setSurveyUrl={setSurveyUrl}
        locale={locale}
      />
    );

    const copyButton = screen.getByLabelText("environments.surveys.copy_survey_link_to_clipboard");
    const previewButton = screen.getByLabelText("environments.surveys.preview_survey_in_a_new_tab");

    expect(copyButton).toBeDisabled();
    expect(previewButton).toBeDisabled();
  });

  test("updates the survey URL when the language is changed", () => {
    const { rerender } = render(
      <ShareSurveyLink
        survey={survey}
        publicDomain={publicDomain}
        surveyUrl={surveyUrl}
        setSurveyUrl={setSurveyUrl}
        locale={locale}
      />
    );

    const languageDropdown = screen.getByTitle("Select Language");
    fireEvent.click(languageDropdown);

    const germanOption = screen.getByText("German");
    fireEvent.click(germanOption);

    rerender(
      <ShareSurveyLink
        survey={survey}
        publicDomain={publicDomain}
        surveyUrl={surveyUrl}
        setSurveyUrl={setSurveyUrl}
        locale={locale}
      />
    );
    expect(setSurveyUrl).toHaveBeenCalled();
    expect(surveyUrl).toContain("lang=de");
  });
});

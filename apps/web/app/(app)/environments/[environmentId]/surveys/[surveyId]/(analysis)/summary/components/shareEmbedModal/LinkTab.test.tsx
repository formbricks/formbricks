import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { LinkTab } from "./LinkTab";

// Mock ShareSurveyLink
vi.mock("@/modules/analysis/components/ShareSurveyLink", () => ({
  ShareSurveyLink: vi.fn(({ survey, surveyUrl, publicDomain, locale }) => (
    <div data-testid="share-survey-link">
      Mocked ShareSurveyLink
      <span data-testid="survey-id">{survey.id}</span>
      <span data-testid="survey-url">{surveyUrl}</span>
      <span data-testid="public-domain">{publicDomain}</span>
      <span data-testid="locale">{locale}</span>
    </div>
  )),
}));

// Mock useTranslate
const mockTranslate = vi.fn((key) => key);
vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: mockTranslate,
  }),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockSurvey: TSurvey = {
  id: "survey1",
  name: "Test Survey",
  type: "link",
  status: "inProgress",
  questions: [],
  thankYouCard: { enabled: false },
  endings: [],
  autoClose: null,
  triggers: [],
  languages: [],
  styling: null,
} as unknown as TSurvey;

const mockSurveyUrl = "https://app.formbricks.com/s/survey1";
const mockPublicDomain = "https://app.formbricks.com";
const mockSetSurveyUrl = vi.fn();
const mockLocale: TUserLocale = "en-US";

const docsLinksExpected = [
  {
    titleKey: "environments.surveys.summary.data_prefilling",
    descriptionKey: "environments.surveys.summary.data_prefilling_description",
    link: "https://formbricks.com/docs/link-surveys/data-prefilling",
  },
  {
    titleKey: "environments.surveys.summary.source_tracking",
    descriptionKey: "environments.surveys.summary.source_tracking_description",
    link: "https://formbricks.com/docs/link-surveys/source-tracking",
  },
  {
    titleKey: "environments.surveys.summary.create_single_use_links",
    descriptionKey: "environments.surveys.summary.create_single_use_links_description",
    link: "https://formbricks.com/docs/link-surveys/single-use-links",
  },
];

describe("LinkTab", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders the main title", () => {
    render(
      <LinkTab
        survey={mockSurvey}
        surveyUrl={mockSurveyUrl}
        publicDomain={mockPublicDomain}
        setSurveyUrl={mockSetSurveyUrl}
        locale={mockLocale}
      />
    );
    expect(
      screen.getByText("environments.surveys.summary.share_the_link_to_get_responses")
    ).toBeInTheDocument();
  });

  test("renders ShareSurveyLink with correct props", () => {
    render(
      <LinkTab
        survey={mockSurvey}
        surveyUrl={mockSurveyUrl}
        publicDomain={mockPublicDomain}
        setSurveyUrl={mockSetSurveyUrl}
        locale={mockLocale}
      />
    );
    expect(screen.getByTestId("share-survey-link")).toBeInTheDocument();
    expect(screen.getByTestId("survey-id")).toHaveTextContent(mockSurvey.id);
    expect(screen.getByTestId("survey-url")).toHaveTextContent(mockSurveyUrl);
    expect(screen.getByTestId("public-domain")).toHaveTextContent(mockPublicDomain);
    expect(screen.getByTestId("locale")).toHaveTextContent(mockLocale);
  });

  test("renders the promotional text for link surveys", () => {
    render(
      <LinkTab
        survey={mockSurvey}
        surveyUrl={mockSurveyUrl}
        publicDomain={mockPublicDomain}
        setSurveyUrl={mockSetSurveyUrl}
        locale={mockLocale}
      />
    );
    expect(
      screen.getByText("environments.surveys.summary.you_can_do_a_lot_more_with_links_surveys 💡")
    ).toBeInTheDocument();
  });

  test("renders all documentation links correctly", () => {
    render(
      <LinkTab
        survey={mockSurvey}
        surveyUrl={mockSurveyUrl}
        publicDomain={mockPublicDomain}
        setSurveyUrl={mockSetSurveyUrl}
        locale={mockLocale}
      />
    );

    docsLinksExpected.forEach((doc) => {
      const linkElement = screen.getByText(doc.titleKey).closest("a");
      expect(linkElement).toBeInTheDocument();
      expect(linkElement).toHaveAttribute("href", doc.link);
      expect(linkElement).toHaveAttribute("target", "_blank");
      expect(screen.getByText(doc.descriptionKey)).toBeInTheDocument();
    });

    expect(mockTranslate).toHaveBeenCalledWith("environments.surveys.summary.data_prefilling");
    expect(mockTranslate).toHaveBeenCalledWith("environments.surveys.summary.data_prefilling_description");
    expect(mockTranslate).toHaveBeenCalledWith("environments.surveys.summary.source_tracking");
    expect(mockTranslate).toHaveBeenCalledWith("environments.surveys.summary.source_tracking_description");
    expect(mockTranslate).toHaveBeenCalledWith("environments.surveys.summary.create_single_use_links");
    expect(mockTranslate).toHaveBeenCalledWith(
      "environments.surveys.summary.create_single_use_links_description"
    );
  });
});

import { EnvironmentContextWrapper } from "@/app/(app)/environments/[environmentId]/context/environment-context";
import { SurveyContextWrapper } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/context/survey-context";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TActionClass, TActionClassNoCodeConfig } from "@formbricks/types/action-classes";
import { TEnvironment } from "@formbricks/types/environment";
import { TProject } from "@formbricks/types/project";
import { TBaseFilter, TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyWelcomeCard } from "@formbricks/types/surveys/types";
import { AppTab } from "./app-tab";

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

// Mock DocumentationLinksSection
vi.mock("./documentation-links-section", () => ({
  DocumentationLinksSection: ({ title, links }: { title: string; links: any[] }) => (
    <div data-testid="documentation-links">
      <h4>{title}</h4>
      {links.map((link) => (
        <div key={link.href} data-testid="documentation-link">
          <a href={link.href}>{link.title}</a>
        </div>
      ))}
    </div>
  ),
}));

// Mock segment
const mockSegment: TSegment = {
  id: "test-segment-id",
  title: "Test Segment",
  description: "Test segment description",
  environmentId: "test-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  isPrivate: false,
  filters: [
    {
      id: "test-filter-id",
      connector: "and",
      resource: "contact",
      attributeKey: "test-attribute-key",
      attributeType: "string",
      condition: "equals",
      value: "test",
    } as unknown as TBaseFilter,
  ],
  surveys: ["test-survey-id"],
};

// Mock action class
const mockActionClass: TActionClass = {
  id: "test-action-id",
  name: "Test Action",
  type: "code",
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "test-env-id",
  description: "Test action description",
  noCodeConfig: null,
  key: "test-action-key",
};

const mockNoCodeActionClass: TActionClass = {
  id: "test-no-code-action-id",
  name: "Test No Code Action",
  type: "noCode",
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId: "test-env-id",
  description: "Test no code action description",
  noCodeConfig: {
    type: "click",
    elementSelector: {
      cssSelector: ".test-button",
      innerHtml: "Click me",
    },
  } as TActionClassNoCodeConfig,
  key: "test-no-code-action-key",
};

// Mock environment data
const mockEnvironment: TEnvironment = {
  id: "test-env-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  type: "development",
  projectId: "test-project-id",
  appSetupCompleted: true,
};

// Mock project data
const mockProject = {
  id: "test-project-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  organizationId: "test-org-id",
  recontactDays: 7,
  config: {
    channel: "app",
    industry: "saas",
  },
  linkSurveyBranding: true,
  styling: {
    allowStyleOverwrite: true,
    brandColor: { light: "#ffffff", dark: "#000000" },
    questionColor: { light: "#000000", dark: "#ffffff" },
    inputColor: { light: "#000000", dark: "#ffffff" },
    inputBorderColor: { light: "#cccccc", dark: "#444444" },
    cardBackgroundColor: { light: "#ffffff", dark: "#000000" },
    cardBorderColor: { light: "#cccccc", dark: "#444444" },
    highlightBorderColor: { light: "#007bff", dark: "#0056b3" },
    isDarkModeEnabled: false,
    isLogoHidden: false,
    hideProgressBar: false,
    roundness: 8,
    cardArrangement: { linkSurveys: "casual", appSurveys: "casual" },
  },
  inAppSurveyBranding: true,
  placement: "bottomRight",
  clickOutsideClose: true,
  darkOverlay: false,
  logo: { url: "test-logo.png", bgColor: "#ffffff" },
} as TProject;

// Mock survey data
const mockSurvey: TSurvey = {
  id: "test-survey-id",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "app",
  environmentId: "test-env-id",
  status: "inProgress",
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [{ actionClass: mockActionClass }],
  recontactDays: null,
  displayLimit: null,
  welcomeCard: { enabled: false } as unknown as TSurveyWelcomeCard,
  questions: [],
  endings: [],
  hiddenFields: { enabled: false },
  displayPercentage: null,
  autoComplete: null,
  segment: null,
  languages: [],
  showLanguageSwitch: false,
  singleUse: { enabled: false, isEncrypted: false },
  projectOverwrites: null,
  surveyClosedMessage: null,
  delay: 0,
  isVerifyEmailEnabled: false,
  inlineTriggers: {},
} as unknown as TSurvey;

describe("AppTab", () => {
  afterEach(() => {
    cleanup();
  });

  const renderWithProviders = (appSetupCompleted = true, surveyOverrides = {}, projectOverrides = {}) => {
    const environmentWithSetup = {
      ...mockEnvironment,
      appSetupCompleted,
    };

    const surveyWithOverrides = {
      ...mockSurvey,
      ...surveyOverrides,
    };

    const projectWithOverrides = {
      ...mockProject,
      ...projectOverrides,
    };

    return render(
      <EnvironmentContextWrapper environment={environmentWithSetup} project={projectWithOverrides}>
        <SurveyContextWrapper survey={surveyWithOverrides}>
          <AppTab />
        </SurveyContextWrapper>
      </EnvironmentContextWrapper>
    );
  };

  test("renders setup completed content when app setup is completed", () => {
    renderWithProviders(true);
    expect(screen.getByText("environments.surveys.summary.in_app.connection_title")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.in_app.connection_description")
    ).toBeInTheDocument();
  });

  test("renders setup required content when app setup is not completed", () => {
    renderWithProviders(false);
    expect(screen.getByText("environments.surveys.summary.in_app.no_connection_title")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.in_app.no_connection_description")
    ).toBeInTheDocument();
    expect(screen.getByText("common.connect_formbricks")).toBeInTheDocument();
  });

  test("displays correct wait time when survey has recontact days", () => {
    renderWithProviders(true, { recontactDays: 5 });
    expect(
      screen.getByText("5 environments.surveys.summary.in_app.display_criteria.time_based_days")
    ).toBeInTheDocument();
    expect(
      screen.getByText("(environments.surveys.summary.in_app.display_criteria.overwritten)")
    ).toBeInTheDocument();
  });

  test("displays correct wait time when survey has 1 recontact day", () => {
    renderWithProviders(true, { recontactDays: 1 });
    expect(
      screen.getByText("1 environments.surveys.summary.in_app.display_criteria.time_based_day")
    ).toBeInTheDocument();
    expect(
      screen.getByText("(environments.surveys.summary.in_app.display_criteria.overwritten)")
    ).toBeInTheDocument();
  });

  test("displays correct wait time when survey has 0 recontact days", () => {
    renderWithProviders(true, { recontactDays: 0 });
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.time_based_always")
    ).toBeInTheDocument();
    expect(
      screen.getByText("(environments.surveys.summary.in_app.display_criteria.overwritten)")
    ).toBeInTheDocument();
  });

  test("displays project recontact days when survey has no recontact days", () => {
    renderWithProviders(true, { recontactDays: null }, { recontactDays: 3 });
    expect(
      screen.getByText("3 environments.surveys.summary.in_app.display_criteria.time_based_days")
    ).toBeInTheDocument();
  });

  test("displays always when project has 0 recontact days", () => {
    renderWithProviders(true, { recontactDays: null }, { recontactDays: 0 });
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.time_based_always")
    ).toBeInTheDocument();
  });

  test("displays always when both survey and project have null recontact days", () => {
    renderWithProviders(true, { recontactDays: null }, { recontactDays: null });
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.time_based_always")
    ).toBeInTheDocument();
  });

  test("displays correct display option for displayOnce", () => {
    renderWithProviders(true, { displayOption: "displayOnce" });
    expect(screen.getByText("environments.surveys.edit.show_only_once")).toBeInTheDocument();
  });

  test("displays correct display option for displayMultiple", () => {
    renderWithProviders(true, { displayOption: "displayMultiple" });
    expect(screen.getByText("environments.surveys.edit.until_they_submit_a_response")).toBeInTheDocument();
  });

  test("displays correct display option for respondMultiple", () => {
    renderWithProviders(true, { displayOption: "respondMultiple" });
    expect(
      screen.getByText("environments.surveys.edit.keep_showing_while_conditions_match")
    ).toBeInTheDocument();
  });

  test("displays correct display option for displaySome", () => {
    renderWithProviders(true, { displayOption: "displaySome" });
    expect(screen.getByText("environments.surveys.edit.show_multiple_times")).toBeInTheDocument();
  });

  test("displays everyone when survey has no segment", () => {
    renderWithProviders(true, { segment: null });
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.everyone")
    ).toBeInTheDocument();
  });

  test("displays targeted when survey has segment with filters", () => {
    renderWithProviders(true, {
      segment: mockSegment,
    });
    expect(screen.getByText("Test Segment")).toBeInTheDocument();
  });

  test("displays segment title when survey has public segment with filters", () => {
    const publicSegment = { ...mockSegment, isPrivate: false, title: "Public Segment" };
    renderWithProviders(true, {
      segment: publicSegment,
    });
    expect(screen.getByText("Public Segment")).toBeInTheDocument();
  });

  test("displays targeted when survey has private segment with filters", () => {
    const privateSegment = { ...mockSegment, isPrivate: true };
    renderWithProviders(true, {
      segment: privateSegment,
    });
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.targeted")
    ).toBeInTheDocument();
  });

  test("displays everyone when survey has segment with no filters", () => {
    const emptySegment = { ...mockSegment, filters: [] };
    renderWithProviders(true, {
      segment: emptySegment,
    });
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.everyone")
    ).toBeInTheDocument();
  });

  test("displays code trigger description correctly", () => {
    renderWithProviders(true, { triggers: [{ actionClass: mockActionClass }] });
    expect(screen.getByText("Test Action")).toBeInTheDocument();
    expect(
      screen.getByText("(environments.surveys.summary.in_app.display_criteria.code_trigger)")
    ).toBeInTheDocument();
  });

  test("displays no-code trigger description correctly", () => {
    renderWithProviders(true, { triggers: [{ actionClass: mockNoCodeActionClass }] });
    expect(screen.getByText("Test No Code Action")).toBeInTheDocument();
    expect(
      screen.getByText(
        "(environments.surveys.summary.in_app.display_criteria.no_code_trigger, environments.actions.click)"
      )
    ).toBeInTheDocument();
  });

  test("displays randomizer when displayPercentage is set", () => {
    renderWithProviders(true, { displayPercentage: 25 });
    expect(
      screen.getAllByText(/environments\.surveys\.summary\.in_app\.display_criteria\.randomizer/)[0]
    ).toBeInTheDocument();
  });

  test("does not display randomizer when displayPercentage is null", () => {
    renderWithProviders(true, { displayPercentage: null });
    expect(screen.queryByText("Show to")).not.toBeInTheDocument();
  });

  test("does not display randomizer when displayPercentage is 0", () => {
    renderWithProviders(true, { displayPercentage: 0 });
    expect(screen.queryByText("Show to")).not.toBeInTheDocument();
  });

  test("renders documentation links section", () => {
    renderWithProviders(true);
    expect(screen.getByTestId("documentation-links")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.in_app.documentation_title")).toBeInTheDocument();
  });

  test("renders all display criteria items", () => {
    renderWithProviders(true);
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.time_based_description")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.audience_description")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.trigger_description")
    ).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.in_app.display_criteria.recontact_description")
    ).toBeInTheDocument();
  });
});

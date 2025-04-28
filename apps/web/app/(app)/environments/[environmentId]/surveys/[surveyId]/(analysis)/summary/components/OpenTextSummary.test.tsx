import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionSummaryOpenText } from "@formbricks/types/surveys/types";
import { OpenTextSummary } from "./OpenTextSummary";

// Mock dependencies
vi.mock("@/lib/time", () => ({
  timeSince: () => "2 hours ago",
}));

vi.mock("@/lib/utils/contact", () => ({
  getContactIdentifier: () => "contact@example.com",
}));

vi.mock("@/modules/analysis/utils", () => ({
  renderHyperlinkedContent: (text: string) => <div data-testid="hyperlinked-content">{text}</div>,
}));

vi.mock("@/modules/ui/components/avatars", () => ({
  PersonAvatar: ({ personId }: { personId: string }) => <div data-testid="person-avatar">{personId}</div>,
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <button onClick={onClick} data-testid="load-more-button">
      {children}
    </button>
  ),
}));

vi.mock("@/modules/ui/components/secondary-navigation", () => ({
  SecondaryNavigation: ({ activeId, navigation }: any) => (
    <div data-testid="secondary-navigation">
      {navigation.map((item: any) => (
        <button key={item.id} onClick={item.onClick} data-active={activeId === item.id}>
          {item.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/modules/ui/components/table", () => ({
  Table: ({ children }: { children: React.ReactNode }) => <table data-testid="table">{children}</table>,
  TableHeader: ({ children }: { children: React.ReactNode }) => <thead>{children}</thead>,
  TableBody: ({ children }: { children: React.ReactNode }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: React.ReactNode }) => <tr>{children}</tr>,
  TableHead: ({ children }: { children: React.ReactNode }) => <th>{children}</th>,
  TableCell: ({ children, width }: { children: React.ReactNode; width?: number }) => (
    <td style={width ? { width } : {}}>{children}</td>
  ),
}));

vi.mock("@/modules/ee/insights/components/insights-view", () => ({
  InsightView: () => <div data-testid="insight-view"></div>,
}));

vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: ({ additionalInfo }: { additionalInfo?: React.ReactNode }) => (
    <div data-testid="question-summary-header">{additionalInfo}</div>
  ),
}));

describe("OpenTextSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const environmentId = "env-123";
  const survey = { id: "survey-1" } as TSurvey;
  const locale = "en-US";

  test("renders response mode by default when insights not enabled", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Open Text Question" },
      samples: [
        {
          id: "response1",
          value: "Sample response text",
          updatedAt: new Date().toISOString(),
          contact: { id: "contact1" },
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryOpenText;

    render(
      <OpenTextSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        isAIEnabled={true}
        locale={locale}
      />
    );

    expect(screen.getByTestId("question-summary-header")).toBeInTheDocument();
    expect(screen.getByTestId("table")).toBeInTheDocument();
    expect(screen.getByTestId("person-avatar")).toHaveTextContent("contact1");
    expect(screen.getByText("contact@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("hyperlinked-content")).toHaveTextContent("Sample response text");
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();

    // No secondary navigation when insights not enabled
    expect(screen.queryByTestId("secondary-navigation")).not.toBeInTheDocument();
  });

  test("shows insights disabled message when AI is enabled but insights are disabled", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Open Text Question" },
      samples: [],
    } as unknown as TSurveyQuestionSummaryOpenText;

    render(
      <OpenTextSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        isAIEnabled={true}
        locale={locale}
      />
    );

    expect(screen.getByText("environments.surveys.summary.insights_disabled")).toBeInTheDocument();
  });

  test("renders anonymous user when no contact is provided", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Open Text Question" },
      samples: [
        {
          id: "response1",
          value: "Anonymous response",
          updatedAt: new Date().toISOString(),
          contact: null,
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryOpenText;

    render(
      <OpenTextSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        isAIEnabled={false}
        locale={locale}
      />
    );

    expect(screen.getByTestId("person-avatar")).toHaveTextContent("anonymous");
    expect(screen.getByText("common.anonymous")).toBeInTheDocument();
  });

  test("shows load more button when there are more responses and loads more on click", async () => {
    const samples = Array.from({ length: 15 }, (_, i) => ({
      id: `response${i}`,
      value: `Response ${i}`,
      updatedAt: new Date().toISOString(),
      contact: null,
      contactAttributes: {},
    }));

    const questionSummary = {
      question: { id: "q1", headline: "Open Text Question" },
      samples,
    } as unknown as TSurveyQuestionSummaryOpenText;

    render(
      <OpenTextSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        isAIEnabled={false}
        locale={locale}
      />
    );

    // Initially 10 responses should be visible
    expect(screen.getAllByTestId("hyperlinked-content")).toHaveLength(10);

    // "Load More" button should be visible
    const loadMoreButton = screen.getByTestId("load-more-button");
    expect(loadMoreButton).toBeInTheDocument();

    // Click "Load More"
    await userEvent.click(loadMoreButton);

    // Now all 15 responses should be visible
    expect(screen.getAllByTestId("hyperlinked-content")).toHaveLength(15);

    // "Load More" button should disappear
    expect(screen.queryByTestId("load-more-button")).not.toBeInTheDocument();
  });
});

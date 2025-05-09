import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionSummaryDate } from "@formbricks/types/surveys/types";
import { DateQuestionSummary } from "./DateQuestionSummary";

vi.mock("@/lib/time", () => ({
  timeSince: () => "2 hours ago",
}));

vi.mock("@/lib/utils/contact", () => ({
  getContactIdentifier: () => "contact@example.com",
}));

vi.mock("@/lib/utils/datetime", () => ({
  formatDateWithOrdinal: (_: Date) => "January 1st, 2023",
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

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="next-link">
      {children}
    </a>
  ),
}));

vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: () => <div data-testid="question-summary-header" />,
}));

describe("DateQuestionSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const environmentId = "env-123";
  const survey = {} as TSurvey;
  const locale = "en-US";

  test("renders table headers correctly", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Date Question" },
      samples: [],
    } as unknown as TSurveyQuestionSummaryDate;

    render(
      <DateQuestionSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByTestId("question-summary-header")).toBeInTheDocument();
    expect(screen.getByText("common.user")).toBeInTheDocument();
    expect(screen.getByText("common.response")).toBeInTheDocument();
    expect(screen.getByText("common.time")).toBeInTheDocument();
  });

  test("renders date responses correctly", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Date Question" },
      samples: [
        {
          id: "response1",
          value: "2023-01-01",
          updatedAt: new Date().toISOString(),
          contact: { id: "contact1" },
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryDate;

    render(
      <DateQuestionSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByText("January 1st, 2023")).toBeInTheDocument();
    expect(screen.getByText("contact@example.com")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();
  });

  test("renders invalid dates with special message", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Date Question" },
      samples: [
        {
          id: "response1",
          value: "invalid-date",
          updatedAt: new Date().toISOString(),
          contact: { id: "contact1" },
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryDate;

    render(
      <DateQuestionSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByText("common.invalid_date(invalid-date)")).toBeInTheDocument();
  });

  test("renders anonymous user when no contact is provided", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Date Question" },
      samples: [
        {
          id: "response1",
          value: "2023-01-01",
          updatedAt: new Date().toISOString(),
          contact: null,
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryDate;

    render(
      <DateQuestionSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByText("common.anonymous")).toBeInTheDocument();
  });

  test("shows load more button when there are more responses and loads more on click", async () => {
    const samples = Array.from({ length: 15 }, (_, i) => ({
      id: `response${i}`,
      value: "2023-01-01",
      updatedAt: new Date().toISOString(),
      contact: null,
      contactAttributes: {},
    }));

    const questionSummary = {
      question: { id: "q1", headline: "Date Question" },
      samples,
    } as unknown as TSurveyQuestionSummaryDate;

    render(
      <DateQuestionSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    // Initially 10 responses should be visible
    expect(screen.getAllByText("January 1st, 2023")).toHaveLength(10);

    // "Load More" button should be visible
    const loadMoreButton = screen.getByTestId("load-more-button");
    expect(loadMoreButton).toBeInTheDocument();

    // Click "Load More"
    await userEvent.click(loadMoreButton);

    // Now all 15 responses should be visible
    expect(screen.getAllByText("January 1st, 2023")).toHaveLength(15);

    // "Load More" button should disappear
    expect(screen.queryByTestId("load-more-button")).not.toBeInTheDocument();
  });
});

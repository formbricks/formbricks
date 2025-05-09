import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyQuestionSummaryContactInfo } from "@formbricks/types/surveys/types";
import { ContactInfoSummary } from "./ContactInfoSummary";

vi.mock("@/lib/time", () => ({
  timeSince: () => "2 hours ago",
}));

vi.mock("@/lib/utils/contact", () => ({
  getContactIdentifier: () => "contact@example.com",
}));

vi.mock("@/modules/ui/components/avatars", () => ({
  PersonAvatar: ({ personId }: { personId: string }) => <div data-testid="person-avatar">{personId}</div>,
}));

vi.mock("@/modules/ui/components/array-response", () => ({
  ArrayResponse: ({ value }: { value: string[] }) => (
    <div data-testid="array-response">{value.join(", ")}</div>
  ),
}));

vi.mock("./QuestionSummaryHeader", () => ({
  QuestionSummaryHeader: () => <div data-testid="question-summary-header" />,
}));

describe("ContactInfoSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const environmentId = "env-123";
  const survey = {} as TSurvey;
  const locale = "en-US";

  test("renders table headers correctly", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Contact Info Question" },
      samples: [],
    } as unknown as TSurveyQuestionSummaryContactInfo;

    render(
      <ContactInfoSummary
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

  test("renders contact information correctly", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Contact Info Question" },
      samples: [
        {
          id: "response1",
          value: ["John Doe", "john@example.com", "+1234567890"],
          updatedAt: new Date().toISOString(),
          contact: { id: "contact1" },
          contactAttributes: { email: "user@example.com" },
        },
      ],
    } as unknown as TSurveyQuestionSummaryContactInfo;

    render(
      <ContactInfoSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByTestId("person-avatar")).toHaveTextContent("contact1");
    expect(screen.getByText("contact@example.com")).toBeInTheDocument();
    expect(screen.getByTestId("array-response")).toHaveTextContent("John Doe, john@example.com, +1234567890");
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();

    // Check link to contact
    const contactLink = screen.getByText("contact@example.com").closest("a");
    expect(contactLink).toHaveAttribute("href", `/environments/${environmentId}/contacts/contact1`);
  });

  test("renders anonymous user when no contact is provided", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Contact Info Question" },
      samples: [
        {
          id: "response2",
          value: ["Anonymous User", "anonymous@example.com"],
          updatedAt: new Date().toISOString(),
          contact: null,
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryContactInfo;

    render(
      <ContactInfoSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getByTestId("person-avatar")).toHaveTextContent("anonymous");
    expect(screen.getByText("common.anonymous")).toBeInTheDocument();
    expect(screen.getByTestId("array-response")).toHaveTextContent("Anonymous User, anonymous@example.com");
  });

  test("renders multiple responses correctly", () => {
    const questionSummary = {
      question: { id: "q1", headline: "Contact Info Question" },
      samples: [
        {
          id: "response1",
          value: ["John Doe", "john@example.com"],
          updatedAt: new Date().toISOString(),
          contact: { id: "contact1" },
          contactAttributes: {},
        },
        {
          id: "response2",
          value: ["Jane Smith", "jane@example.com"],
          updatedAt: new Date().toISOString(),
          contact: { id: "contact2" },
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryContactInfo;

    render(
      <ContactInfoSummary
        questionSummary={questionSummary}
        environmentId={environmentId}
        survey={survey}
        locale={locale}
      />
    );

    expect(screen.getAllByTestId("person-avatar")).toHaveLength(2);
    expect(screen.getAllByTestId("array-response")).toHaveLength(2);
    expect(screen.getAllByText("2 hours ago")).toHaveLength(2);
  });
});

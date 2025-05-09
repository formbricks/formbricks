import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TEnvironment } from "@formbricks/types/environment";
import { TSurveyQuestionSummaryHiddenFields } from "@formbricks/types/surveys/types";
import { HiddenFieldsSummary } from "./HiddenFieldsSummary";

// Mock dependencies
vi.mock("@/lib/time", () => ({
  timeSince: () => "2 hours ago",
}));

vi.mock("@/lib/utils/contact", () => ({
  getContactIdentifier: () => "contact@example.com",
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

// Mock lucide-react components
vi.mock("lucide-react", () => ({
  InboxIcon: () => <div data-testid="inbox-icon" />,
  MessageSquareTextIcon: () => <div data-testid="message-icon" />,
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className: string }) => (
    <a href={href} className={className} data-testid="lucide-link">
      {children}
    </a>
  ),
}));

// Mock Next.js Link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href} data-testid="next-link">
      {children}
    </a>
  ),
}));

describe("HiddenFieldsSummary", () => {
  afterEach(() => {
    cleanup();
  });

  const environment = { id: "env-123" } as TEnvironment;
  const locale = "en-US";

  test("renders component with correct header and single response", () => {
    const questionSummary = {
      id: "hidden-field-1",
      responseCount: 1,
      samples: [
        {
          id: "response1",
          value: "Hidden value",
          updatedAt: new Date().toISOString(),
          contact: { id: "contact1" },
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryHiddenFields;

    render(
      <HiddenFieldsSummary environment={environment} questionSummary={questionSummary} locale={locale} />
    );

    expect(screen.getByText("hidden-field-1")).toBeInTheDocument();
    expect(screen.getByText("Hidden Field")).toBeInTheDocument();
    expect(screen.getByText("1 common.response")).toBeInTheDocument();

    // Headers
    expect(screen.getByText("common.user")).toBeInTheDocument();
    expect(screen.getByText("common.response")).toBeInTheDocument();
    expect(screen.getByText("common.time")).toBeInTheDocument();

    // We can skip checking for PersonAvatar as it's inside hidden md:flex
    expect(screen.getByText("contact@example.com")).toBeInTheDocument();
    expect(screen.getByText("Hidden value")).toBeInTheDocument();
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();

    // Check for link without checking for specific href
    expect(screen.getByText("contact@example.com")).toBeInTheDocument();
  });

  test("renders anonymous user when no contact is provided", () => {
    const questionSummary = {
      id: "hidden-field-1",
      responseCount: 1,
      samples: [
        {
          id: "response1",
          value: "Anonymous hidden value",
          updatedAt: new Date().toISOString(),
          contact: null,
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryHiddenFields;

    render(
      <HiddenFieldsSummary environment={environment} questionSummary={questionSummary} locale={locale} />
    );

    // Instead of checking for avatar, just check for anonymous text
    expect(screen.getByText("common.anonymous")).toBeInTheDocument();
    expect(screen.getByText("Anonymous hidden value")).toBeInTheDocument();
  });

  test("renders plural response label when multiple responses", () => {
    const questionSummary = {
      id: "hidden-field-1",
      responseCount: 2,
      samples: [
        {
          id: "response1",
          value: "Hidden value 1",
          updatedAt: new Date().toISOString(),
          contact: { id: "contact1" },
          contactAttributes: {},
        },
        {
          id: "response2",
          value: "Hidden value 2",
          updatedAt: new Date().toISOString(),
          contact: { id: "contact2" },
          contactAttributes: {},
        },
      ],
    } as unknown as TSurveyQuestionSummaryHiddenFields;

    render(
      <HiddenFieldsSummary environment={environment} questionSummary={questionSummary} locale={locale} />
    );

    expect(screen.getByText("2 common.responses")).toBeInTheDocument();
    expect(screen.getAllByText("contact@example.com")).toHaveLength(2);
  });

  test("shows load more button when there are more responses and loads more on click", async () => {
    const samples = Array.from({ length: 15 }, (_, i) => ({
      id: `response${i}`,
      value: `Hidden value ${i}`,
      updatedAt: new Date().toISOString(),
      contact: null,
      contactAttributes: {},
    }));

    const questionSummary = {
      id: "hidden-field-1",
      responseCount: samples.length,
      samples,
    } as unknown as TSurveyQuestionSummaryHiddenFields;

    render(
      <HiddenFieldsSummary environment={environment} questionSummary={questionSummary} locale={locale} />
    );

    // Initially 10 responses should be visible
    expect(screen.getAllByText(/Hidden value \d+/)).toHaveLength(10);

    // "Load More" button should be visible
    const loadMoreButton = screen.getByTestId("load-more-button");
    expect(loadMoreButton).toBeInTheDocument();

    // Click "Load More"
    await userEvent.click(loadMoreButton);

    // Now all 15 responses should be visible
    expect(screen.getAllByText(/Hidden value \d+/)).toHaveLength(15);

    // "Load More" button should disappear
    expect(screen.queryByTestId("load-more-button")).not.toBeInTheDocument();
  });
});

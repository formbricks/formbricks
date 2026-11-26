import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TDisplayWithContact } from "@formbricks/types/displays";
import { SummaryImpressions } from "./SummaryImpressions";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/app/(app)/workspaces/[workspaceId]/context/workspace-context", () => ({
  useWorkspace: () => ({ workspace: { id: "ws-1" } }),
}));

const display = (contact: TDisplayWithContact["contact"]): TDisplayWithContact => ({
  id: "cldisplay1111111111111111",
  createdAt: new Date("2026-11-01T00:00:00Z"),
  surveyId: "clsurvey11111111111111111",
  contact,
});

const renderImpressions = (displays: TDisplayWithContact[]) =>
  render(
    <SummaryImpressions
      displays={displays}
      isLoading={false}
      hasMore={false}
      displaysError={null}
      locale="en-US"
      onLoadMore={vi.fn()}
      onRetry={vi.fn()}
    />
  );

describe("SummaryImpressions contact column", () => {
  afterEach(cleanup);

  test("links a contact the workspace reaches, by its email", () => {
    renderImpressions([
      display({ id: "contact-1", attributes: { email: "ada@example.com", userId: "user-1" } }),
    ]);

    expect(screen.getByRole("link", { name: "ada@example.com" })).toHaveAttribute(
      "href",
      "/workspaces/ws-1/contacts/contact-1"
    );
    expect(screen.queryByText("workspace.surveys.responses.contact_not_available")).not.toBeInTheDocument();
  });

  test("shows a contact out of reach unlinked, as anonymous, marked not available", () => {
    renderImpressions([display({ id: "contact-1", attributes: {}, unavailable: true })]);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("common.anonymous")).toBeInTheDocument();
    expect(screen.getByText("workspace.surveys.responses.contact_not_available")).toBeInTheDocument();
    expect(screen.queryByText("contact-1")).not.toBeInTheDocument();
  });
});

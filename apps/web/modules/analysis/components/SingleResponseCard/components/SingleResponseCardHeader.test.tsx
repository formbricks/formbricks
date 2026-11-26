import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { TResponse } from "@formbricks/types/responses";
import type { TSurvey } from "@formbricks/types/surveys/types";
import type { TUser } from "@formbricks/types/user";
import { SingleResponseCardHeader } from "./SingleResponseCardHeader";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/app/(app)/workspaces/[workspaceId]/context/workspace-context", () => ({
  useWorkspace: () => ({ workspace: { id: "ws-1" } }),
}));
vi.mock("@/modules/analysis/response-outcome/components/outcome-badge", () => ({ OutcomeBadge: () => null }));
vi.mock("@/modules/analysis/response-outcome/components/response-outcome-button", () => ({
  ResponseOutcomeButton: () => null,
}));

const baseResponse = {
  id: "response-1",
  createdAt: new Date("2026-11-01T10:00:00Z"),
  updatedAt: new Date("2026-11-01T10:00:00Z"),
  finished: true,
  outcome: null,
  contactAttributes: { email: "saved@example.com", userId: "saved-user" },
};

const renderHeader = (contact: TResponse["contact"]) =>
  render(
    <SingleResponseCardHeader
      pageType="response"
      response={{ ...baseResponse, contact } as unknown as TResponse}
      survey={{ id: "survey-1", workspaceId: "ws-1", status: "inProgress" } as unknown as TSurvey}
      user={{ id: "user-1" } as TUser}
      isReadOnly
      setDeleteDialogOpen={vi.fn()}
      locale="en-US"
    />
  );

describe("SingleResponseCardHeader › contact", () => {
  afterEach(cleanup);

  test("links a reachable contact and shows its userId", () => {
    renderHeader({ id: "contact-1", userId: "user-42" });

    expect(screen.getByRole("link", { name: /saved@example.com/ })).toHaveAttribute(
      "href",
      "/workspaces/ws-1/contacts/contact-1"
    );
    expect(screen.getByText("user-42")).toBeInTheDocument();
    expect(screen.queryByText("workspace.surveys.responses.contact_not_available")).not.toBeInTheDocument();
  });

  test("shows the saved identifier without a link or userId for a contact the workspace no longer reaches", () => {
    renderHeader({ id: "contact-1", userId: "user-42", unavailable: true });

    expect(screen.getByText("saved@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("user-42")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "workspace.surveys.responses.contact_not_available" })
    ).toBeInTheDocument();
  });
});

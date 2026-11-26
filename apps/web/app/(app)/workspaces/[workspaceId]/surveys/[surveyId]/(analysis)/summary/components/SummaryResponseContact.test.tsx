import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SummaryResponseContact } from "./SummaryResponseContact";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const savedAttributes = { email: "saved@example.com" };

describe("SummaryResponseContact", () => {
  afterEach(cleanup);

  test("links a contact the workspace reaches", () => {
    render(
      <SummaryResponseContact
        contact={{ id: "contact-1", userId: "user-1" }}
        contactAttributes={savedAttributes}
        workspaceId="ws-1"
      />
    );

    expect(screen.getByRole("link", { name: /saved@example.com/ })).toHaveAttribute(
      "href",
      "/workspaces/ws-1/contacts/contact-1"
    );
    expect(screen.queryByText("workspace.surveys.responses.contact_not_available")).not.toBeInTheDocument();
  });

  test("shows the saved identifier unlinked, marked not available, for a contact out of reach", () => {
    render(
      <SummaryResponseContact
        contact={{ id: "contact-1", unavailable: true }}
        contactAttributes={savedAttributes}
        workspaceId="ws-1"
      />
    );

    expect(screen.getByText("saved@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("workspace.surveys.responses.contact_not_available")).toBeInTheDocument();
  });

  test("shows Anonymous without a contact", () => {
    render(<SummaryResponseContact contact={null} contactAttributes={null} workspaceId="ws-1" />);

    expect(screen.getByText("common.anonymous")).toBeInTheDocument();
  });
});

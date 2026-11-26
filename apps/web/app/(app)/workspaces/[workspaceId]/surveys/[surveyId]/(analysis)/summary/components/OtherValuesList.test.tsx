import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OtherValuesList } from "./OtherValuesList";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/app/(app)/workspaces/[workspaceId]/context/workspace-context", () => ({
  useWorkspace: () => ({ workspace: { id: "ws-1" } }),
}));

describe("OtherValuesList › contact", () => {
  afterEach(cleanup);

  test("links a contact the workspace reaches", () => {
    render(
      <OtherValuesList
        surveyType="app"
        others={[
          { value: "Typed", contact: { id: "contact-1" }, contactAttributes: { email: "saved@example.com" } },
        ]}
      />
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/workspaces/ws-1/contacts/contact-1");
  });

  test("shows the saved identifier unlinked, marked not available, for a contact out of reach", () => {
    render(
      <OtherValuesList
        surveyType="app"
        others={[
          {
            value: "Typed",
            contact: { id: "contact-1", unavailable: true },
            contactAttributes: { email: "saved@example.com" },
          },
        ]}
      />
    );

    expect(screen.getByText("saved@example.com")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("workspace.surveys.responses.contact_not_available")).toBeInTheDocument();
  });
});

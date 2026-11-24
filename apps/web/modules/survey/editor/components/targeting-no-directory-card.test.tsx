import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TargetingNoDirectoryCard } from "./targeting-no-directory-card";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/app/(app)/workspaces/[workspaceId]/context/workspace-context", () => ({
  useWorkspace: () => ({ workspace: { id: "ws-1", organizationId: "org-1" } }),
}));

const openCard = () => fireEvent.click(screen.getByText("workspace.segments.target_audience"));

describe("TargetingNoDirectoryCard", () => {
  afterEach(cleanup);

  test("sends an owner or manager to Contact directories", () => {
    render(<TargetingNoDirectoryCard membershipRole="manager" />);
    expect(screen.getByText("workspace.contacts.no_contact_directory_title")).toBeInTheDocument();

    openCard();

    expect(screen.getByText("workspace.contacts.no_contact_directory_admin_description")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "workspace.contacts.go_to_contact_directories" })
    ).toHaveAttribute("href", "/organizations/org-1/settings/contact-directories");
  });

  test("asks a member to ask an owner or manager, with no link", () => {
    render(<TargetingNoDirectoryCard membershipRole="member" />);

    openCard();

    expect(
      screen.getByText("workspace.contacts.no_contact_directory_member_description")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});

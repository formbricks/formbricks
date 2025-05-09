import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CreateTeamButton } from "./create-team-button";

vi.mock("@/modules/ee/teams/team-list/components/create-team-modal", () => ({
  CreateTeamModal: ({ open, setOpen, organizationId }: any) =>
    open ? <div data-testid="CreateTeamModal">{organizationId}</div> : null,
}));

describe("CreateTeamButton", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders button with tolgee string", () => {
    render(<CreateTeamButton organizationId="org-1" />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.create_new_team")).toBeInTheDocument();
  });

  test("opens CreateTeamModal on button click", async () => {
    render(<CreateTeamButton organizationId="org-2" />);
    await userEvent.click(screen.getByRole("button"));
    expect(screen.getByTestId("CreateTeamModal")).toHaveTextContent("org-2");
  });
});

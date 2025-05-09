import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ManageTeam } from "./manage-team";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: ({ tooltipContent, children }: any) => (
    <div data-testid="TooltipRenderer">
      <span>{tooltipContent}</span>
      {children}
    </div>
  ),
}));

describe("ManageTeam", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders enabled button and navigates when isOwnerOrManager is true", async () => {
    render(<ManageTeam environmentId="env-123" isOwnerOrManager={true} />);
    const button = screen.getByRole("button");
    expect(button).toBeEnabled();
    expect(screen.getByText("environments.project.teams.manage_teams")).toBeInTheDocument();
    await userEvent.click(button);
  });

  test("renders disabled button with tooltip when isOwnerOrManager is false", () => {
    render(<ManageTeam environmentId="env-123" isOwnerOrManager={false} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(screen.getByText("environments.project.teams.manage_teams")).toBeInTheDocument();
    expect(screen.getByTestId("TooltipRenderer")).toBeInTheDocument();
    expect(
      screen.getByText("environments.project.teams.only_organization_owners_and_managers_can_manage_teams")
    ).toBeInTheDocument();
  });
});

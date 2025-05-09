import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ManageTeamButton } from "./manage-team-button";

vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipRenderer: ({ shouldRender, tooltipContent, children }: any) =>
    shouldRender ? (
      <div data-testid="TooltipRenderer">
        {tooltipContent}
        {children}
      </div>
    ) : (
      <>{children}</>
    ),
}));

describe("ManageTeamButton", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders enabled button and calls onClick", async () => {
    const onClick = vi.fn();
    render(<ManageTeamButton onClick={onClick} disabled={false} />);
    const button = screen.getByRole("button");
    expect(button).toBeEnabled();
    expect(screen.getByText("environments.settings.teams.manage_team")).toBeInTheDocument();
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalled();
  });

  test("renders disabled button with tooltip", () => {
    const onClick = vi.fn();
    render(<ManageTeamButton onClick={onClick} disabled={true} />);
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    expect(screen.getByText("environments.settings.teams.manage_team")).toBeInTheDocument();
    expect(screen.getByTestId("TooltipRenderer")).toBeInTheDocument();
    expect(screen.getByText("environments.settings.teams.manage_team_disabled")).toBeInTheDocument();
  });
});

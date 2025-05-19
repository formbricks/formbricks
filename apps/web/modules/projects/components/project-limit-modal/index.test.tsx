import { ModalButton } from "@/modules/ui/components/upgrade-prompt";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ProjectLimitModal } from "./index";

vi.mock("@/modules/ui/components/dialog", () => ({
  Dialog: ({ open, onOpenChange, children }: any) =>
    open ? (
      <div data-testid="dialog" onClick={() => onOpenChange(false)}>
        {children}
      </div>
    ) : null,
  DialogContent: ({ children, className }: any) => (
    <div data-testid="dialog-content" className={className}>
      {children}
    </div>
  ),
  DialogTitle: ({ children }: any) => <h2 data-testid="dialog-title">{children}</h2>,
}));

vi.mock("@/modules/ui/components/upgrade-prompt", () => ({
  UpgradePrompt: ({ title, description, buttons }: any) => (
    <div data-testid="upgrade-prompt">
      <div>{title}</div>
      <div>{description}</div>
      <button onClick={buttons[0].onClick}>{buttons[0].text}</button>
      <button onClick={buttons[1].onClick}>{buttons[1].text}</button>
    </div>
  ),
}));

describe("ProjectLimitModal", () => {
  afterEach(() => {
    cleanup();
  });

  const setOpen = vi.fn();
  const buttons: [ModalButton, ModalButton] = [
    { text: "Start Trial", onClick: vi.fn() },
    { text: "Upgrade", onClick: vi.fn() },
  ];

  test("renders dialog and upgrade prompt with correct props", () => {
    render(<ProjectLimitModal open={true} setOpen={setOpen} projectLimit={3} buttons={buttons} />);
    expect(screen.getByTestId("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toHaveClass("bg-white");
    expect(screen.getByTestId("dialog-title")).toHaveTextContent("common.projects_limit_reached");
    expect(screen.getByTestId("upgrade-prompt")).toBeInTheDocument();
    expect(screen.getByText("common.unlock_more_projects_with_a_higher_plan")).toBeInTheDocument();
    expect(screen.getByText("common.you_have_reached_your_limit_of_project_limit")).toBeInTheDocument();
    expect(screen.getByText("Start Trial")).toBeInTheDocument();
    expect(screen.getByText("Upgrade")).toBeInTheDocument();
  });

  test("calls setOpen(false) when dialog is closed", async () => {
    render(<ProjectLimitModal open={true} setOpen={setOpen} projectLimit={3} buttons={buttons} />);
    await userEvent.click(screen.getByTestId("dialog"));
    expect(setOpen).toHaveBeenCalledWith(false);
  });

  test("calls button onClick handlers", async () => {
    render(<ProjectLimitModal open={true} setOpen={setOpen} projectLimit={3} buttons={buttons} />);
    await userEvent.click(screen.getByText("Start Trial"));
    expect(vi.mocked(buttons[0].onClick)).toHaveBeenCalled();
    await userEvent.click(screen.getByText("Upgrade"));
    expect(vi.mocked(buttons[1].onClick)).toHaveBeenCalled();
  });

  test("does not render when open is false", () => {
    render(<ProjectLimitModal open={false} setOpen={setOpen} projectLimit={3} buttons={buttons} />);
    expect(screen.queryByTestId("dialog")).not.toBeInTheDocument();
  });
});

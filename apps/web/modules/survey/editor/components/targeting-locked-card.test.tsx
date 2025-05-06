import { TargetingLockedCard } from "@/modules/survey/editor/components/targeting-locked-card";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

interface UpgradePromptButton {
  text: string;
}

interface UpgradePromptProps {
  title: string;
  description: string;
  buttons?: UpgradePromptButton[];
}

vi.mock("@/modules/ui/components/upgrade-prompt", () => ({
  UpgradePrompt: ({ title, description, buttons }: UpgradePromptProps) => (
    <div data-testid="upgrade-prompt-mock">
      <div>{title}</div>
      <div>{description}</div>
      <div>{buttons?.map((button: UpgradePromptButton) => <div key={button.text}>{button.text}</div>)}</div>
    </div>
  ),
}));

describe("TargetingLockedCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders correctly when isFormbricksCloud is true and environmentId is a valid string", () => {
    render(<TargetingLockedCard isFormbricksCloud={true} environmentId="test-env-id" />);
    expect(screen.getByText("environments.segments.target_audience")).toBeInTheDocument();
  });

  test("renders translated text for labels and descriptions", () => {
    render(<TargetingLockedCard isFormbricksCloud={true} environmentId="test-env-id" />);
    expect(screen.getByText("environments.segments.target_audience")).toBeInTheDocument();
    expect(screen.getByText("environments.segments.pre_segment_users")).toBeInTheDocument();
  });

  test("handles undefined environmentId gracefully without crashing", () => {
    render(<TargetingLockedCard isFormbricksCloud={true} environmentId={undefined as any} />);
    expect(screen.getByText("environments.segments.target_audience")).toBeInTheDocument();
  });

  test("toggles collapsible content when the trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<TargetingLockedCard isFormbricksCloud={true} environmentId="test-env-id" />);

    const trigger = screen.getByText("environments.segments.target_audience");

    // Initially, the content should NOT be present (closed by default)
    expect(screen.queryByTestId("upgrade-prompt-mock")).not.toBeInTheDocument();

    // Click the trigger to open the content
    await user.click(trigger);
    expect(screen.getByTestId("upgrade-prompt-mock")).toBeInTheDocument();

    // Click the trigger again to close the content
    await user.click(trigger);
    expect(screen.queryByTestId("upgrade-prompt-mock")).not.toBeInTheDocument();
  });

  test("renders UpgradePrompt with correct title, description, and buttons when isFormbricksCloud is true", async () => {
    render(<TargetingLockedCard isFormbricksCloud={true} environmentId="test-env-id" />);

    // Open the collapsible
    const trigger = screen.getByText("environments.segments.target_audience");
    await userEvent.click(trigger);

    expect(screen.getByText("environments.surveys.edit.unlock_targeting_title")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.edit.unlock_targeting_description")).toBeInTheDocument();
    expect(screen.getByText("common.start_free_trial")).toBeInTheDocument();
    expect(screen.getByText("common.learn_more")).toBeInTheDocument();
  });
});

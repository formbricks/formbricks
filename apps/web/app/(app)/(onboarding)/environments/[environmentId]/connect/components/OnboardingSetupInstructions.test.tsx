import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { OnboardingSetupInstructions } from "./OnboardingSetupInstructions";

// Mock react-hot-toast so we can assert that a success message is shown
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  default: {
    success: vi.fn(),
  },
}));

// Set up a spy for navigator.clipboard.writeText so it becomes a ViTest spy.
beforeAll(() => {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    writable: true,
    value: {
      // Using a mockResolvedValue resolves the promise as writeText is async.
      writeText: vi.fn().mockResolvedValue(undefined),
    },
  });
});

describe("OnboardingSetupInstructions", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // Provide some default props for testing
  const defaultProps = {
    environmentId: "env-123",
    publicDomain: "https://example.com",
    channel: "app" as const, // Assuming channel is either "app" or "website"
    widgetSetupCompleted: false,
  };

  test("renders HTML tab content by default", () => {
    render(<OnboardingSetupInstructions {...defaultProps} />);

    // Since the default active tab is "html", we check for a unique text
    expect(
      screen.getByText(/environments.connect.insert_this_code_into_the_head_tag_of_your_website/i)
    ).toBeInTheDocument();

    // The HTML snippet contains a marker comment
    expect(screen.getByText("START")).toBeInTheDocument();

    // Verify the "Copy Code" button is present
    expect(screen.getByRole("button", { name: /common.copy_code/i })).toBeInTheDocument();
  });

  test("renders NPM tab content when selected", async () => {
    render(<OnboardingSetupInstructions {...defaultProps} />);
    const user = userEvent.setup();

    // Click on the "NPM" tab to switch views.
    const npmTab = screen.getByText("NPM");
    await user.click(npmTab);

    // Check that the install commands are present
    expect(screen.getByText(/npm install @formbricks\/js/)).toBeInTheDocument();
    expect(screen.getByText(/yarn add @formbricks\/js/)).toBeInTheDocument();

    // Verify the "Read Docs" link has the correct URL (based on channel prop)
    const readDocsLink = screen.getByRole("link", { name: /common.read_docs/i });
    expect(readDocsLink).toHaveAttribute("href", "https://formbricks.com/docs/app-surveys/framework-guides");
  });

  test("copies HTML snippet to clipboard and shows success toast when Copy Code button is clicked", async () => {
    render(<OnboardingSetupInstructions {...defaultProps} />);
    const user = userEvent.setup();

    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");

    // Click the "Copy Code" button
    const copyButton = screen.getByRole("button", { name: /common.copy_code/i });
    await user.click(copyButton);

    // Ensure navigator.clipboard.writeText was called.
    expect(writeTextSpy).toHaveBeenCalled();
    const writtenText = (navigator.clipboard.writeText as any).mock.calls[0][0] as string;

    // Check that the pasted snippet contains the expected environment values
    expect(writtenText).toContain('var appUrl = "https://example.com"');
    expect(writtenText).toContain('var environmentId = "env-123"');

    // Verify that a success toast was shown
    expect(toast.success).toHaveBeenCalledWith("common.copied_to_clipboard");
  });

  test("renders step-by-step manual link with correct URL in HTML tab", () => {
    render(<OnboardingSetupInstructions {...defaultProps} />);
    const manualLink = screen.getByRole("link", { name: /common.step_by_step_manual/i });
    expect(manualLink).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/app-surveys/framework-guides#html"
    );
  });
});

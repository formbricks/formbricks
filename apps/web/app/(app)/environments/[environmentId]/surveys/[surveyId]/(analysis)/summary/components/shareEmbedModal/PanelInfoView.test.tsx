import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { PanelInfoView } from "./PanelInfoView";

// Mock next/image
vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: any; alt: string; className?: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src.src} alt={alt} className={className} />
  ),
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, target }: { children: React.ReactNode; href: string; target?: string }) => (
    <a href={href} target={target}>
      {children}
    </a>
  ),
}));

// Mock Button component
vi.mock("@/modules/ui/components/button", () => ({
  Button: ({ children, onClick, variant, asChild }: any) => {
    if (asChild) {
      return <div onClick={onClick}>{children}</div>; // NOSONAR
    }
    return (
      <button onClick={onClick} data-variant={variant}>
        {children}
      </button>
    );
  },
}));

// Mock lucide-react
vi.mock("lucide-react", () => ({
  ArrowLeftIcon: vi.fn(() => <div data-testid="arrow-left-icon">ArrowLeftIcon</div>),
}));

const mockHandleInitialPageButton = vi.fn();

describe("PanelInfoView", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("renders correctly with back button and all sections", async () => {
    render(<PanelInfoView disableBack={false} handleInitialPageButton={mockHandleInitialPageButton} />);

    // Check for back button
    const backButton = screen.getByText("common.back");
    expect(backButton).toBeInTheDocument();
    expect(screen.getByTestId("arrow-left-icon")).toBeInTheDocument();

    // Check images
    expect(screen.getAllByAltText("Prolific panel selection UI")[0]).toBeInTheDocument();
    expect(screen.getAllByAltText("Prolific panel selection UI")[1]).toBeInTheDocument();

    // Check text content (Tolgee keys)
    expect(screen.getByText("environments.surveys.summary.what_is_a_panel")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.what_is_a_panel_answer")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.when_do_i_need_it")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.when_do_i_need_it_answer")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.what_is_prolific")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.what_is_prolific_answer")).toBeInTheDocument();

    expect(screen.getByText("environments.surveys.summary.how_to_create_a_panel")).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.how_to_create_a_panel_step_1")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.how_to_create_a_panel_step_1_description")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.how_to_create_a_panel_step_2")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.how_to_create_a_panel_step_2_description")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.how_to_create_a_panel_step_3")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.how_to_create_a_panel_step_3_description")
    ).toBeInTheDocument();
    expect(screen.getByText("environments.surveys.summary.how_to_create_a_panel_step_4")).toBeInTheDocument();
    expect(
      screen.getByText("environments.surveys.summary.how_to_create_a_panel_step_4_description")
    ).toBeInTheDocument();

    // Check "Learn more" link
    const learnMoreLink = screen.getByRole("link", { name: "common.learn_more" });
    expect(learnMoreLink).toBeInTheDocument();
    expect(learnMoreLink).toHaveAttribute(
      "href",
      "https://formbricks.com/docs/xm-and-surveys/surveys/link-surveys/market-research-panel"
    );
    expect(learnMoreLink).toHaveAttribute("target", "_blank");

    // Click back button
    await userEvent.click(backButton);
    expect(mockHandleInitialPageButton).toHaveBeenCalledTimes(1);
  });

  test("renders correctly without back button when disableBack is true", () => {
    render(<PanelInfoView disableBack={true} handleInitialPageButton={mockHandleInitialPageButton} />);

    expect(screen.queryByRole("button", { name: "common.back" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("arrow-left-icon")).not.toBeInTheDocument();
  });
});

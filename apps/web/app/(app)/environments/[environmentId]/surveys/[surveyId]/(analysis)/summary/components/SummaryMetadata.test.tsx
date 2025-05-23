import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SummaryMetadata } from "./SummaryMetadata";

vi.mock("lucide-react", () => ({
  ChevronDownIcon: () => <div data-testid="down" />,
  ChevronUpIcon: () => <div data-testid="up" />,
}));
vi.mock("@/modules/ui/components/tooltip", () => ({
  TooltipProvider: ({ children }) => <>{children}</>,
  Tooltip: ({ children }) => <>{children}</>,
  TooltipTrigger: ({ children, onClick }) => (
    <button tabIndex={0} onClick={onClick} style={{ display: "inline-block" }}>
      {children}
    </button>
  ),
  TooltipContent: ({ children }) => <>{children}</>,
}));

const baseSummary = {
  completedPercentage: 50,
  completedResponses: 2,
  displayCount: 3,
  dropOffPercentage: 25,
  dropOffCount: 1,
  startsPercentage: 75,
  totalResponses: 4,
  ttcAverage: 65000,
};

describe("SummaryMetadata", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders loading skeletons when isLoading=true", () => {
    const { container } = render(
      <SummaryMetadata
        showDropOffs={false}
        setShowDropOffs={() => {}}
        surveySummary={baseSummary}
        isLoading={true}
      />
    );

    expect(container.getElementsByClassName("animate-pulse")).toHaveLength(5);
  });

  test("renders all stats and formats time correctly, toggles dropOffs icon", async () => {
    const Wrapper = () => {
      const [show, setShow] = useState(false);
      return (
        <SummaryMetadata
          showDropOffs={show}
          setShowDropOffs={setShow}
          surveySummary={baseSummary}
          isLoading={false}
        />
      );
    };
    render(<Wrapper />);
    // impressions, starts, completed, drop_offs, ttc
    expect(screen.getByText("environments.surveys.summary.impressions")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("1m 5.00s")).toBeInTheDocument();
    const btn = screen
      .getAllByRole("button")
      .find((el) => el.textContent?.includes("environments.surveys.summary.drop_offs"));
    if (!btn) throw new Error("DropOffs toggle button not found");
    await userEvent.click(btn);
    expect(screen.queryByTestId("up")).toBeInTheDocument();
  });

  test("formats time correctly when < 60 seconds", () => {
    const smallSummary = { ...baseSummary, ttcAverage: 5000 };
    render(
      <SummaryMetadata
        showDropOffs={false}
        setShowDropOffs={() => {}}
        surveySummary={smallSummary}
        isLoading={false}
      />
    );
    expect(screen.getByText("5.00s")).toBeInTheDocument();
  });

  test("renders '-' for dropOffCount=0 and still toggles icon", async () => {
    const zeroSummary = { ...baseSummary, dropOffCount: 0 };
    const Wrapper = () => {
      const [show, setShow] = useState(false);
      return (
        <SummaryMetadata
          showDropOffs={show}
          setShowDropOffs={setShow}
          surveySummary={zeroSummary}
          isLoading={false}
        />
      );
    };
    render(<Wrapper />);
    expect(screen.getAllByText("-")).toHaveLength(1);
    const btn = screen
      .getAllByRole("button")
      .find((el) => el.textContent?.includes("environments.surveys.summary.drop_offs"));
    if (!btn) throw new Error("DropOffs toggle button not found");
    await userEvent.click(btn);
    expect(screen.queryByTestId("up")).toBeInTheDocument();
  });

  test("renders '-' for displayCount=0", () => {
    const dispZero = { ...baseSummary, displayCount: 0 };
    render(
      <SummaryMetadata
        showDropOffs={false}
        setShowDropOffs={() => {}}
        surveySummary={dispZero}
        isLoading={false}
      />
    );
    expect(screen.getAllByText("-")).toHaveLength(1);
  });

  test("renders '-' for totalResponses=0", () => {
    const totZero = { ...baseSummary, totalResponses: 0 };
    render(
      <SummaryMetadata
        showDropOffs={false}
        setShowDropOffs={() => {}}
        surveySummary={totZero}
        isLoading={false}
      />
    );
    expect(screen.getAllByText("-")).toHaveLength(1);
  });
});

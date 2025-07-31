import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { ResponseBadges } from "./index";

// Mock the IdBadge component
vi.mock("@/modules/ui/components/id-badge", () => ({
  IdBadge: ({ id }: { id: string }) => (
    <div data-testid="id-badge" data-id={id}>
      ID: {id}
    </div>
  ),
}));

describe("ResponseBadges", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders items with value property correctly", () => {
    const items = [{ value: "Apple" }, { value: "Banana" }, { value: "Cherry" }];
    render(<ResponseBadges items={items} showId={false} />);

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();

    const badges = screen.getAllByText(/Apple|Banana|Cherry/);
    expect(badges).toHaveLength(3);

    badges.forEach((badge) => {
      expect(badge.closest("span")).toHaveClass("bg-slate-200");
      expect(badge.closest("span")).toHaveClass("rounded-md");
      expect(badge.closest("span")).toHaveClass("px-2");
      expect(badge.closest("span")).toHaveClass("py-1");
      expect(badge.closest("span")).toHaveClass("font-medium");
    });
  });

  test("renders number items with value property correctly", () => {
    const items = [{ value: 1 }, { value: 2 }, { value: 3 }];
    render(<ResponseBadges items={items} showId={false} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("renders items with id property and shows IdBadge when showId=true", () => {
    const items = [
      { value: "Apple", id: "choice1" },
      { value: "Banana", id: "choice2" },
      { value: "Cherry" }, // No id property
    ];
    render(<ResponseBadges items={items} showId={true} />);

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();
    expect(screen.getByText("Cherry")).toBeInTheDocument();

    // Should show IdBadges for items with id
    const idBadges = screen.getAllByTestId("id-badge");
    expect(idBadges).toHaveLength(2);
    expect(idBadges[0]).toHaveAttribute("data-id", "choice1");
    expect(idBadges[1]).toHaveAttribute("data-id", "choice2");
  });

  test("does not render IdBadge when showId=false", () => {
    const items = [
      { value: "Apple", id: "choice1" },
      { value: "Banana", id: "choice2" },
    ];
    render(<ResponseBadges items={items} showId={false} />);

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();

    // Should not show IdBadges when showId=false
    expect(screen.queryByTestId("id-badge")).not.toBeInTheDocument();
  });

  test("does not render IdBadge when item has no id property", () => {
    const items = [{ value: "Apple" }, { value: "Banana" }];
    render(<ResponseBadges items={items} showId={true} />);

    expect(screen.getByText("Apple")).toBeInTheDocument();
    expect(screen.getByText("Banana")).toBeInTheDocument();

    // Should not show IdBadges when items have no id
    expect(screen.queryByTestId("id-badge")).not.toBeInTheDocument();
  });

  test("applies expanded layout when isExpanded=true", () => {
    const items = [{ value: "Apple" }, { value: "Banana" }, { value: "Cherry" }];

    const { container } = render(<ResponseBadges items={items} isExpanded={true} showId={false} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("flex-wrap");
  });

  test("does not apply expanded layout when isExpanded=false", () => {
    const items = [{ value: "Apple" }, { value: "Banana" }, { value: "Cherry" }];

    const { container } = render(<ResponseBadges items={items} isExpanded={false} showId={false} />);

    const wrapper = container.firstChild;
    expect(wrapper).not.toHaveClass("flex-wrap");
  });

  test("applies column layout when showId=true", () => {
    const items = [{ value: "Apple", id: "choice1" }];

    const { container } = render(<ResponseBadges items={items} showId={true} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("flex-col");
  });

  test("does not apply column layout when showId=false", () => {
    const items = [{ value: "Apple", id: "choice1" }];

    const { container } = render(<ResponseBadges items={items} showId={false} />);

    const wrapper = container.firstChild;
    expect(wrapper).not.toHaveClass("flex-col");
  });

  test("renders with icon when provided", () => {
    const items = [{ value: "Apple" }];
    const icon = <span data-testid="test-icon">📱</span>;

    render(<ResponseBadges items={items} icon={icon} showId={false} />);

    expect(screen.getByTestId("test-icon")).toBeInTheDocument();
    expect(screen.getByText("📱")).toBeInTheDocument();
  });

  test("applies default styles correctly", () => {
    const items = [{ value: "Apple" }];

    const { container } = render(<ResponseBadges items={items} showId={false} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("my-1");
    expect(wrapper).toHaveClass("flex");
    expect(wrapper).toHaveClass("gap-2");
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { ResponseBadges } from "./index";

describe("ResponseBadges", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders string items correctly", () => {
    const items = ["Apple", "Banana", "Cherry"];
    render(<ResponseBadges items={items} />);

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

  test("renders number items correctly", () => {
    const items = [1, 2, 3];
    render(<ResponseBadges items={items} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  test("applies expanded layout when isExpanded=true", () => {
    const items = ["Apple", "Banana", "Cherry"];

    const { container } = render(<ResponseBadges items={items} isExpanded={true} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("flex-wrap");
  });

  test("does not apply expanded layout when isExpanded=false", () => {
    const items = ["Apple", "Banana", "Cherry"];

    const { container } = render(<ResponseBadges items={items} isExpanded={false} />);

    const wrapper = container.firstChild;
    expect(wrapper).not.toHaveClass("flex-wrap");
  });

  test("applies default styles correctly", () => {
    const items = ["Apple"];

    const { container } = render(<ResponseBadges items={items} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass("my-1");
    expect(wrapper).toHaveClass("flex");
    expect(wrapper).toHaveClass("gap-2");
  });
});

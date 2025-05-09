import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TabBar } from "./index";

describe("TabBar", () => {
  afterEach(() => {
    cleanup();
  });

  const mockTabs = [
    { id: "tab1", label: "Tab One" },
    { id: "tab2", label: "Tab Two" },
    { id: "tab3", label: "Tab Three" },
  ];

  test("calls setActiveId when tab is clicked", async () => {
    const handleSetActiveId = vi.fn();
    const user = userEvent.setup();

    render(<TabBar tabs={mockTabs} activeId="tab1" setActiveId={handleSetActiveId} />);

    await user.click(screen.getByText("Tab Two"));

    expect(handleSetActiveId).toHaveBeenCalledTimes(1);
    expect(handleSetActiveId).toHaveBeenCalledWith("tab2");
  });

  test("renders tabs with icons", () => {
    const tabsWithIcons = [
      { id: "tab1", label: "Tab One", icon: <span data-testid="icon1">🔍</span> },
      { id: "tab2", label: "Tab Two", icon: <span data-testid="icon2">📁</span> },
    ];

    render(<TabBar tabs={tabsWithIcons} activeId="tab1" setActiveId={() => {}} />);

    expect(screen.getByTestId("icon1")).toBeInTheDocument();
    expect(screen.getByTestId("icon2")).toBeInTheDocument();
  });

  test("applies custom className", () => {
    const { container } = render(
      <TabBar tabs={mockTabs} activeId="tab1" setActiveId={() => {}} className="custom-class" />
    );

    const tabContainer = container.firstChild as HTMLElement;
    expect(tabContainer).toHaveClass("custom-class");
  });

  test("applies activeTabClassName to active tab", () => {
    render(
      <TabBar
        tabs={mockTabs}
        activeId="tab1"
        setActiveId={() => {}}
        activeTabClassName="custom-active-class"
      />
    );

    const activeTab = screen.getByText("Tab One").closest("button");
    expect(activeTab).toHaveClass("custom-active-class");
  });

  test("renders in disabled state", async () => {
    const handleSetActiveId = vi.fn();
    const user = userEvent.setup();

    render(
      <TabBar
        tabs={mockTabs}
        activeId="tab1"
        setActiveId={handleSetActiveId}
        tabStyle="button"
        disabled={true}
      />
    );

    const navContainer = screen.getByRole("navigation");
    expect(navContainer).toHaveClass("cursor-not-allowed");
    expect(navContainer).toHaveClass("opacity-50");

    await user.click(screen.getByText("Tab Two"));

    expect(handleSetActiveId).not.toHaveBeenCalled();
  });

  test("doesn't apply disabled styles when not disabled", () => {
    render(
      <TabBar tabs={mockTabs} activeId="tab1" setActiveId={() => {}} tabStyle="button" disabled={false} />
    );

    const navContainer = screen.getByRole("navigation");
    expect(navContainer).not.toHaveClass("cursor-not-allowed");
    expect(navContainer).not.toHaveClass("opacity-50");
  });
});

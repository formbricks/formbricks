import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TabNav } from "./index";

describe("TabNav", () => {
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

    render(<TabNav tabs={mockTabs} activeId="tab1" setActiveId={handleSetActiveId} />);

    await user.click(screen.getByText("Tab Two"));

    expect(handleSetActiveId).toHaveBeenCalledTimes(1);
    expect(handleSetActiveId).toHaveBeenCalledWith("tab2");
  });

  test("renders tabs with icons", () => {
    const tabsWithIcons = [
      { id: "tab1", label: "Tab One", icon: <span data-testid="icon1">🔍</span> },
      { id: "tab2", label: "Tab Two", icon: <span data-testid="icon2">📁</span> },
    ];

    render(<TabNav tabs={tabsWithIcons} activeId="tab1" setActiveId={() => {}} />);

    expect(screen.getByTestId("icon1")).toBeInTheDocument();
    expect(screen.getByTestId("icon2")).toBeInTheDocument();
  });

  test("applies activeTabClassName to active tab", () => {
    render(
      <TabNav
        tabs={mockTabs}
        activeId="tab1"
        setActiveId={() => {}}
        activeTabClassName="custom-active-class"
      />
    );

    const activeTab = screen.getByText("Tab One").closest("button");
    expect(activeTab).toHaveClass("custom-active-class");
  });

  test("renders navigation container", () => {
    render(<TabNav tabs={mockTabs} activeId="tab1" setActiveId={() => {}} />);

    const navContainer = screen.getByRole("navigation");
    expect(navContainer).toBeInTheDocument();
  });
});

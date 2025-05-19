import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SecondaryNavigation } from "./index";

// Mock next/link
vi.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, onClick }: any) => (
    <a href={href} onClick={onClick} data-testid="mock-link">
      {children}
    </a>
  ),
}));

describe("SecondaryNavigation", () => {
  afterEach(() => {
    cleanup();
  });

  const mockNavigation = [
    { id: "tab1", label: "Tab 1", href: "/tab1" },
    { id: "tab2", label: "Tab 2", href: "/tab2" },
    { id: "tab3", label: "Tab 3", onClick: vi.fn() },
    { id: "tab4", label: "Hidden Tab", href: "/tab4", hidden: true },
  ];

  test("renders navigation items correctly", () => {
    render(<SecondaryNavigation navigation={mockNavigation} activeId="tab1" />);

    // Visible tabs
    expect(screen.getByText("Tab 1")).toBeInTheDocument();
    expect(screen.getByText("Tab 2")).toBeInTheDocument();
    expect(screen.getByText("Tab 3")).toBeInTheDocument();

    // Hidden tab
    expect(screen.queryByText("Hidden Tab")).not.toBeInTheDocument();
  });

  test("renders links for items with href", () => {
    render(<SecondaryNavigation navigation={mockNavigation} activeId="tab1" />);

    const links = screen.getAllByTestId("mock-link");
    expect(links).toHaveLength(2); // tab1 and tab2

    expect(links[0]).toHaveAttribute("href", "/tab1");
    expect(links[1]).toHaveAttribute("href", "/tab2");
  });

  test("renders buttons for items without href", () => {
    render(<SecondaryNavigation navigation={mockNavigation} activeId="tab1" />);

    const button = screen.getByRole("button", { name: "Tab 3" });
    expect(button).toBeInTheDocument();
  });

  test("calls onClick function when button is clicked", async () => {
    const user = userEvent.setup();
    render(<SecondaryNavigation navigation={mockNavigation} activeId="tab1" />);

    const button = screen.getByRole("button", { name: "Tab 3" });
    await user.click(button);

    expect(mockNavigation[2].onClick).toHaveBeenCalled();
  });
});

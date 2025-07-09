import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "./index";

// Mock the useIsMobile hook - this is already mocked in vitestSetup.ts
vi.mock("@/modules/ui/hooks/use-mobile", () => ({
  useIsMobile: vi.fn().mockReturnValue(false),
}));

// Mock Button component
vi.mock("@/modules/ui/components/button", () => {
  const MockButton = React.forwardRef<HTMLButtonElement, any>(({ children, onClick, ...props }, ref) => (
    <button ref={ref} onClick={onClick} {...props}>
      {children}
    </button>
  ));
  MockButton.displayName = "MockButton";

  return {
    Button: MockButton,
  };
});

// Mock Input component
vi.mock("@/modules/ui/components/input", () => {
  const MockInput = React.forwardRef<HTMLInputElement, any>((props, ref) => <input ref={ref} {...props} />);
  MockInput.displayName = "MockInput";

  return {
    Input: MockInput,
  };
});

// Mock Separator component
vi.mock("@/modules/ui/components/separator", () => {
  const MockSeparator = React.forwardRef<HTMLDivElement, any>((props, ref) => (
    <div ref={ref} role="separator" {...props} />
  ));
  MockSeparator.displayName = "MockSeparator";

  return {
    Separator: MockSeparator,
  };
});

// Mock Sheet components
vi.mock("@/modules/ui/components/sheet", () => ({
  Sheet: ({ children, open, onOpenChange }: any) => (
    <div data-testid="sheet" data-open={open} onClick={() => onOpenChange?.(!open)}>
      {children}
    </div>
  ),
  SheetContent: ({ children, side, ...props }: any) => (
    <div data-testid="sheet-content" data-side={side} {...props}>
      {children}
    </div>
  ),
  SheetHeader: ({ children }: any) => <div data-testid="sheet-header">{children}</div>,
  SheetTitle: ({ children }: any) => <div data-testid="sheet-title">{children}</div>,
  SheetDescription: ({ children }: any) => <div data-testid="sheet-description">{children}</div>,
}));

// Mock Skeleton component
vi.mock("@/modules/ui/components/skeleton", () => ({
  Skeleton: ({ className, style, ...props }: any) => (
    <div data-testid="skeleton" className={className} style={style} {...props} />
  ),
}));

// Mock Tooltip components
vi.mock("@/modules/ui/components/tooltip", () => ({
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children, hidden, ...props }: any) => (
    <div data-testid="tooltip-content" data-hidden={hidden} {...props}>
      {children}
    </div>
  ),
  TooltipProvider: ({ children }: any) => <div data-testid="tooltip-provider">{children}</div>,
  TooltipTrigger: ({ children }: any) => <div data-testid="tooltip-trigger">{children}</div>,
}));

// Mock Slot from @radix-ui/react-slot
vi.mock("@radix-ui/react-slot", () => {
  const MockSlot = React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));
  MockSlot.displayName = "MockSlot";

  return {
    Slot: MockSlot,
  };
});

// Mock Lucide icons
vi.mock("lucide-react", () => ({
  Columns2Icon: () => <div data-testid="columns2-icon" />,
}));

// Mock cn utility
vi.mock("@/modules/ui/lib/utils", () => ({
  cn: (...args: any[]) => args.filter(Boolean).flat().join(" "),
}));

// Test component that uses useSidebar hook
const TestComponent = () => {
  const sidebar = useSidebar();
  return (
    <div>
      <div data-testid="sidebar-state">{sidebar?.state || "unknown"}</div>
      <div data-testid="sidebar-open">{sidebar?.open?.toString() || "unknown"}</div>
      <div data-testid="sidebar-mobile">{sidebar?.isMobile?.toString() || "unknown"}</div>
      <div data-testid="sidebar-open-mobile">{sidebar?.openMobile?.toString() || "unknown"}</div>
      <button data-testid="toggle-button" onClick={sidebar?.toggleSidebar}>
        Toggle
      </button>
      <button data-testid="set-open-button" onClick={() => sidebar?.setOpen?.(true)}>
        Set Open
      </button>
      <button data-testid="set-open-mobile-button" onClick={() => sidebar?.setOpenMobile?.(true)}>
        Set Open Mobile
      </button>
    </div>
  );
};

describe("Sidebar Components", () => {
  beforeEach(() => {
    // Reset document.cookie
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });

    // Mock addEventListener and removeEventListener
    global.addEventListener = vi.fn();
    global.removeEventListener = vi.fn();

    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Core Functionality", () => {
    test("useSidebar hook throws error when used outside provider", () => {
      const TestComponentWithoutProvider = () => {
        useSidebar();
        return <div>Test</div>;
      };

      expect(() => render(<TestComponentWithoutProvider />)).toThrow(
        "useSidebar must be used within a SidebarProvider."
      );
    });

    test("SidebarProvider manages state and provides context correctly", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();

      // Test with default state
      const { rerender } = render(
        <SidebarProvider>
          <TestComponent />
        </SidebarProvider>
      );

      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
      expect(screen.getByTestId("sidebar-open")).toHaveTextContent("true");

      // Test toggle functionality
      await user.click(screen.getByTestId("toggle-button"));
      expect(document.cookie).toContain("sidebar_state=false");

      // Test with controlled state
      rerender(
        <SidebarProvider open={false} onOpenChange={onOpenChange}>
          <TestComponent />
        </SidebarProvider>
      );

      expect(screen.getByTestId("sidebar-open")).toHaveTextContent("false");
      fireEvent.click(screen.getByTestId("set-open-button"));
      expect(onOpenChange).toHaveBeenCalledWith(true);

      // Test mobile functionality
      await user.click(screen.getByTestId("set-open-mobile-button"));
      expect(screen.getByTestId("sidebar-open-mobile")).toHaveTextContent("true");
    });

    test("SidebarProvider handles keyboard shortcuts and cleanup", () => {
      const preventDefault = vi.fn();

      const { unmount } = render(
        <SidebarProvider>
          <TestComponent />
        </SidebarProvider>
      );

      // Test keyboard shortcut registration
      expect(global.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));

      // Test keyboard shortcut handling
      const [[, eventHandler]] = vi.mocked(global.addEventListener).mock.calls;

      // Valid shortcut
      (eventHandler as (event: any) => void)({
        key: "b",
        ctrlKey: true,
        preventDefault,
      });
      expect(preventDefault).toHaveBeenCalled();

      // Invalid shortcut
      preventDefault.mockClear();
      (eventHandler as (event: any) => void)({
        key: "a",
        ctrlKey: true,
        preventDefault,
      });
      expect(preventDefault).not.toHaveBeenCalled();

      // Test cleanup
      unmount();
      expect(global.removeEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));
    });
  });

  describe("Interactive Components", () => {
    test("SidebarTrigger and SidebarRail toggle sidebar functionality", async () => {
      const user = userEvent.setup();
      const customOnClick = vi.fn();

      render(
        <SidebarProvider>
          <SidebarTrigger onClick={customOnClick} />
          <SidebarRail />
          <TestComponent />
        </SidebarProvider>
      );

      // Test SidebarTrigger
      const trigger = screen.getByTestId("columns2-icon").closest("button");
      expect(trigger).toBeInTheDocument();
      await user.click(trigger!);
      expect(customOnClick).toHaveBeenCalled();
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");

      // Test SidebarRail
      const rail = screen.getByLabelText("Toggle Sidebar");
      expect(rail).toHaveAttribute("aria-label", "Toggle Sidebar");
      await user.click(rail);
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
    });

    test("Sidebar renders with different configurations", () => {
      const { rerender } = render(
        <SidebarProvider>
          <Sidebar collapsible="none" variant="floating" side="right">
            <div>Sidebar Content</div>
          </Sidebar>
        </SidebarProvider>
      );

      expect(screen.getByText("Sidebar Content")).toBeInTheDocument();

      // Test different variants
      rerender(
        <SidebarProvider>
          <Sidebar variant="inset">
            <div>Sidebar Content</div>
          </Sidebar>
        </SidebarProvider>
      );

      expect(screen.getByText("Sidebar Content")).toBeInTheDocument();
    });
  });

  describe("Layout Components", () => {
    test("basic layout components render correctly with custom classes", () => {
      const layoutComponents = [
        { Component: SidebarInset, content: "Main Content", selector: "main" },
        { Component: SidebarInput, content: null, selector: "input", props: { placeholder: "Search..." } },
        { Component: SidebarHeader, content: "Header Content", selector: '[data-sidebar="header"]' },
        { Component: SidebarFooter, content: "Footer Content", selector: '[data-sidebar="footer"]' },
        { Component: SidebarSeparator, content: null, selector: '[role="separator"]' },
        { Component: SidebarContent, content: "Content", selector: '[data-sidebar="content"]' },
      ];

      layoutComponents.forEach(({ Component, content, selector, props = {} }) => {
        const testProps = { className: "custom-class", ...props };

        render(
          <SidebarProvider>
            <Component {...testProps}>{content && <div>{content}</div>}</Component>
          </SidebarProvider>
        );

        if (content) {
          expect(screen.getByText(content)).toBeInTheDocument();
          const element = screen.getByText(content).closest(selector);
          expect(element).toHaveClass("custom-class");
        } else if (selector === "input") {
          expect(screen.getByRole("textbox")).toHaveClass("custom-class");
        } else {
          expect(screen.getByRole("separator")).toHaveClass("custom-class");
        }

        cleanup();
      });
    });
  });

  describe("Group Components", () => {
    test("sidebar group components render and handle interactions", async () => {
      const user = userEvent.setup();

      render(
        <SidebarProvider>
          <SidebarGroup className="group-class">
            <SidebarGroupLabel className="label-class">Group Label</SidebarGroupLabel>
            <SidebarGroupAction className="action-class">
              <div>Action</div>
            </SidebarGroupAction>
            <SidebarGroupContent className="content-class">
              <div>Group Content</div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarProvider>
      );

      // Test all components render
      expect(screen.getByText("Group Label")).toBeInTheDocument();
      expect(screen.getByText("Group Content")).toBeInTheDocument();

      // Test action button
      const actionButton = screen.getByRole("button");
      expect(actionButton).toBeInTheDocument();
      await user.click(actionButton);

      // Test custom classes
      expect(screen.getByText("Group Label")).toHaveClass("label-class");
      expect(screen.getByText("Group Content").closest('[data-sidebar="group-content"]')).toHaveClass(
        "content-class"
      );
      expect(actionButton).toHaveClass("action-class");
    });

    test("sidebar group components handle asChild prop", () => {
      render(
        <SidebarProvider>
          <SidebarGroupLabel asChild>
            <h2>Group Label</h2>
          </SidebarGroupLabel>
          <SidebarGroupAction asChild>
            <button>Action</button>
          </SidebarGroupAction>
        </SidebarProvider>
      );

      expect(screen.getByText("Group Label")).toBeInTheDocument();
      expect(screen.getByText("Action")).toBeInTheDocument();
    });
  });

  describe("Menu Components", () => {
    test("basic menu components render with custom classes", () => {
      render(
        <SidebarProvider>
          <SidebarMenu className="menu-class">
            <SidebarMenuItem className="item-class">
              <div>Menu Item</div>
            </SidebarMenuItem>
          </SidebarMenu>
          <SidebarMenuBadge className="badge-class">5</SidebarMenuBadge>
        </SidebarProvider>
      );

      expect(screen.getByText("Menu Item")).toBeInTheDocument();
      expect(screen.getByText("5")).toBeInTheDocument();

      const menu = screen.getByText("Menu Item").closest("ul");
      const menuItem = screen.getByText("Menu Item").closest("li");

      expect(menu).toHaveClass("menu-class");
      expect(menuItem).toHaveClass("item-class");
      expect(screen.getByText("5")).toHaveClass("badge-class");
    });

    test("SidebarMenuButton handles all variants and interactions", async () => {
      const { rerender } = render(
        <SidebarProvider>
          <SidebarMenuButton
            isActive
            variant="outline"
            size="sm"
            tooltip="Button tooltip"
            className="button-class">
            <div>Menu Button</div>
          </SidebarMenuButton>
        </SidebarProvider>
      );

      const button = screen.getByText("Menu Button").closest("button");
      expect(button).toHaveAttribute("data-active", "true");
      expect(button).toHaveAttribute("data-size", "sm");
      expect(button).toHaveClass("button-class");
      expect(screen.getByTestId("tooltip")).toBeInTheDocument();

      // Test tooltip object
      rerender(
        <SidebarProvider>
          <SidebarMenuButton tooltip={{ children: "Button tooltip", side: "left" }}>
            <div>Menu Button</div>
          </SidebarMenuButton>
        </SidebarProvider>
      );

      expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();

      // Test asChild
      rerender(
        <SidebarProvider>
          <SidebarMenuButton asChild>
            <a href="#">Menu Button</a>
          </SidebarMenuButton>
        </SidebarProvider>
      );

      expect(screen.getByText("Menu Button")).toBeInTheDocument();
    });

    test("SidebarMenuAction handles showOnHover and asChild", () => {
      const { rerender } = render(
        <SidebarProvider>
          <SidebarMenuAction showOnHover>
            <div>Action</div>
          </SidebarMenuAction>
        </SidebarProvider>
      );

      expect(screen.getByText("Action")).toBeInTheDocument();

      rerender(
        <SidebarProvider>
          <SidebarMenuAction asChild>
            <button>Action</button>
          </SidebarMenuAction>
        </SidebarProvider>
      );

      expect(screen.getByText("Action")).toBeInTheDocument();
    });

    test("SidebarMenuSkeleton renders with icon option", () => {
      const { rerender } = render(
        <SidebarProvider>
          <SidebarMenuSkeleton className="skeleton-class" />
        </SidebarProvider>
      );

      expect(screen.getByTestId("skeleton")).toBeInTheDocument();

      const skeleton = screen.getAllByTestId("skeleton")[0].parentElement;
      expect(skeleton).toHaveClass("skeleton-class");

      rerender(
        <SidebarProvider>
          <SidebarMenuSkeleton showIcon />
        </SidebarProvider>
      );

      expect(screen.getAllByTestId("skeleton")).toHaveLength(2);
    });
  });

  describe("Sub Menu Components", () => {
    test("sub menu components render and handle all props", () => {
      const { rerender } = render(
        <SidebarProvider>
          <SidebarMenuSub className="sub-menu-class">
            <SidebarMenuSubItem>
              <SidebarMenuSubButton isActive size="sm" className="sub-button-class">
                <div>Sub Button</div>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </SidebarMenuSub>
        </SidebarProvider>
      );

      expect(screen.getByText("Sub Button")).toBeInTheDocument();

      const subMenu = screen.getByText("Sub Button").closest("ul");
      const subButton = screen.getByText("Sub Button").closest("a");

      expect(subMenu).toHaveClass("sub-menu-class");
      expect(subButton).toHaveAttribute("data-active", "true");
      expect(subButton).toHaveAttribute("data-size", "sm");
      expect(subButton).toHaveClass("sub-button-class");

      // Test asChild
      rerender(
        <SidebarProvider>
          <SidebarMenuSubButton asChild>
            <button>Sub Button</button>
          </SidebarMenuSubButton>
        </SidebarProvider>
      );

      expect(screen.getByText("Sub Button")).toBeInTheDocument();
    });
  });

  describe("Provider Configuration", () => {
    test("SidebarProvider handles custom props and styling", () => {
      render(
        <SidebarProvider className="custom-class" style={{ backgroundColor: "red" }} defaultOpen={false}>
          <TestComponent />
        </SidebarProvider>
      );

      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
      expect(screen.getByTestId("sidebar-open")).toHaveTextContent("false");

      const wrapper = screen.getByText("collapsed").closest(".group\\/sidebar-wrapper");
      expect(wrapper).toHaveClass("custom-class");
    });

    test("function callback handling for setOpen", async () => {
      const user = userEvent.setup();

      const TestComponentWithCallback = () => {
        const { setOpen } = useSidebar();
        return (
          <button data-testid="function-callback-button" onClick={() => setOpen(false)}>
            Set False
          </button>
        );
      };

      render(
        <SidebarProvider>
          <TestComponentWithCallback />
          <TestComponent />
        </SidebarProvider>
      );

      expect(screen.getByTestId("sidebar-open")).toHaveTextContent("true");
      await user.click(screen.getByTestId("function-callback-button"));
      expect(screen.getByTestId("sidebar-open")).toHaveTextContent("false");
    });
  });
});

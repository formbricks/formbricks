import * as SheetPrimitive from "@radix-ui/react-dialog";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from ".";

// Mock Radix UI Dialog components (Sheet uses Dialog primitives)
vi.mock("@radix-ui/react-dialog", () => {
  const Root = vi.fn(({ children }) => <div data-testid="sheet-root">{children}</div>) as any;
  Root.displayName = "SheetRoot";

  const Trigger = vi.fn(({ children }) => <button data-testid="sheet-trigger">{children}</button>) as any;
  Trigger.displayName = "SheetTrigger";

  const Portal = vi.fn(({ children }) => <div data-testid="sheet-portal">{children}</div>) as any;
  Portal.displayName = "SheetPortal";

  const Overlay = vi.fn(({ className, ...props }) => (
    <div data-testid="sheet-overlay" className={className} {...props} />
  )) as any;
  Overlay.displayName = "SheetOverlay";

  const Content = vi.fn(({ className, children, ...props }) => (
    <div data-testid="sheet-content" className={className} {...props}>
      {children}
    </div>
  )) as any;
  Content.displayName = "SheetContent";

  const Close = vi.fn(({ className, children }) => (
    <button data-testid="sheet-close" className={className}>
      {children}
    </button>
  )) as any;
  Close.displayName = "SheetClose";

  const Title = vi.fn(({ className, children, ...props }) => (
    <h2 data-testid="sheet-title" className={className} {...props}>
      {children}
    </h2>
  )) as any;
  Title.displayName = "SheetTitle";

  const Description = vi.fn(({ className, children, ...props }) => (
    <p data-testid="sheet-description" className={className} {...props}>
      {children}
    </p>
  )) as any;
  Description.displayName = "SheetDescription";

  return {
    Root,
    Trigger,
    Portal,
    Overlay,
    Content,
    Close,
    Title,
    Description,
  };
});

// Mock Lucide React
vi.mock("lucide-react", () => ({
  XIcon: ({ className }: { className?: string }) => (
    <div data-testid="x-icon" className={className}>
      X Icon
    </div>
  ),
}));

describe("Sheet Components", () => {
  afterEach(() => {
    cleanup();
  });

  test("Sheet renders correctly", () => {
    render(
      <Sheet>
        <div>Sheet Content</div>
      </Sheet>
    );

    expect(screen.getByTestId("sheet-root")).toBeInTheDocument();
    expect(screen.getByText("Sheet Content")).toBeInTheDocument();
  });

  test("SheetTrigger renders correctly", () => {
    render(
      <SheetTrigger>
        <span>Open Sheet</span>
      </SheetTrigger>
    );

    expect(screen.getByTestId("sheet-trigger")).toBeInTheDocument();
    expect(screen.getByText("Open Sheet")).toBeInTheDocument();
  });

  test("SheetClose renders correctly", () => {
    render(
      <SheetClose>
        <span>Close Sheet</span>
      </SheetClose>
    );

    expect(screen.getByTestId("sheet-close")).toBeInTheDocument();
    expect(screen.getByText("Close Sheet")).toBeInTheDocument();
  });

  test("SheetPortal renders correctly", () => {
    render(
      <SheetPortal>
        <div>Portal Content</div>
      </SheetPortal>
    );

    expect(screen.getByTestId("sheet-portal")).toBeInTheDocument();
    expect(screen.getByText("Portal Content")).toBeInTheDocument();
  });

  test("SheetOverlay renders with correct classes", () => {
    render(<SheetOverlay className="test-class" />);

    const overlay = screen.getByTestId("sheet-overlay");
    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveClass("test-class");
    expect(overlay).toHaveClass("fixed");
    expect(overlay).toHaveClass("inset-0");
    expect(overlay).toHaveClass("z-50");
    expect(overlay).toHaveClass("bg-black/80");
  });

  test("SheetContent renders with default variant (right)", () => {
    render(
      <SheetContent>
        <div>Test Content</div>
      </SheetContent>
    );

    expect(screen.getByTestId("sheet-portal")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-content")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-close")).toBeInTheDocument();
    expect(screen.getByTestId("x-icon")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
    expect(screen.getByText("Close")).toBeInTheDocument();
  });

  test("SheetContent applies correct variant classes", () => {
    const { rerender } = render(
      <SheetContent side="top">
        <div>Top Content</div>
      </SheetContent>
    );

    let content = screen.getByTestId("sheet-content");
    expect(content).toHaveClass("inset-x-0");
    expect(content).toHaveClass("top-0");
    expect(content).toHaveClass("border-b");
    expect(content).toHaveClass("data-[state=closed]:slide-out-to-top");
    expect(content).toHaveClass("data-[state=open]:slide-in-from-top");

    rerender(
      <SheetContent side="bottom">
        <div>Bottom Content</div>
      </SheetContent>
    );

    content = screen.getByTestId("sheet-content");
    expect(content).toHaveClass("inset-x-0");
    expect(content).toHaveClass("bottom-0");
    expect(content).toHaveClass("border-t");
    expect(content).toHaveClass("data-[state=closed]:slide-out-to-bottom");
    expect(content).toHaveClass("data-[state=open]:slide-in-from-bottom");

    rerender(
      <SheetContent side="left">
        <div>Left Content</div>
      </SheetContent>
    );

    content = screen.getByTestId("sheet-content");
    expect(content).toHaveClass("inset-y-0");
    expect(content).toHaveClass("left-0");
    expect(content).toHaveClass("h-full");
    expect(content).toHaveClass("w-3/4");
    expect(content).toHaveClass("border-r");
    expect(content).toHaveClass("data-[state=closed]:slide-out-to-left");
    expect(content).toHaveClass("data-[state=open]:slide-in-from-left");
    expect(content).toHaveClass("sm:max-w-sm");

    rerender(
      <SheetContent side="right">
        <div>Right Content</div>
      </SheetContent>
    );

    content = screen.getByTestId("sheet-content");
    expect(content).toHaveClass("inset-y-0");
    expect(content).toHaveClass("right-0");
    expect(content).toHaveClass("h-full");
    expect(content).toHaveClass("w-3/4");
    expect(content).toHaveClass("border-l");
    expect(content).toHaveClass("data-[state=closed]:slide-out-to-right");
    expect(content).toHaveClass("data-[state=open]:slide-in-from-right");
    expect(content).toHaveClass("sm:max-w-sm");
  });

  test("SheetContent applies custom className", () => {
    render(
      <SheetContent className="custom-class">
        <div>Custom Content</div>
      </SheetContent>
    );

    const content = screen.getByTestId("sheet-content");
    expect(content).toHaveClass("custom-class");
  });

  test("SheetContent has correct base classes", () => {
    render(
      <SheetContent>
        <div>Base Content</div>
      </SheetContent>
    );

    const content = screen.getByTestId("sheet-content");
    expect(content).toHaveClass("fixed");
    expect(content).toHaveClass("z-50");
    expect(content).toHaveClass("gap-4");
    expect(content).toHaveClass("bg-background");
    expect(content).toHaveClass("p-6");
    expect(content).toHaveClass("shadow-lg");
    expect(content).toHaveClass("transition");
    expect(content).toHaveClass("ease-in-out");
    expect(content).toHaveClass("data-[state=closed]:duration-300");
    expect(content).toHaveClass("data-[state=open]:duration-500");
  });

  test("SheetContent close button has correct styling", () => {
    render(
      <SheetContent>
        <div>Content</div>
      </SheetContent>
    );

    const closeButton = screen.getByTestId("sheet-close");
    expect(closeButton).toHaveClass("ring-offset-background");
    expect(closeButton).toHaveClass("focus:ring-ring");
    expect(closeButton).toHaveClass("data-[state=open]:bg-secondary");
    expect(closeButton).toHaveClass("absolute");
    expect(closeButton).toHaveClass("right-4");
    expect(closeButton).toHaveClass("top-4");
    expect(closeButton).toHaveClass("rounded-sm");
    expect(closeButton).toHaveClass("opacity-70");
    expect(closeButton).toHaveClass("transition-opacity");
    expect(closeButton).toHaveClass("hover:opacity-100");
  });

  test("SheetContent close button icon has correct styling", () => {
    render(
      <SheetContent>
        <div>Content</div>
      </SheetContent>
    );

    const icon = screen.getByTestId("x-icon");
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveClass("h-4");
    expect(icon).toHaveClass("w-4");
  });

  test("SheetHeader renders correctly", () => {
    render(
      <SheetHeader className="test-class">
        <div>Header Content</div>
      </SheetHeader>
    );

    const header = screen.getByText("Header Content").parentElement;
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("test-class");
    expect(header).toHaveClass("flex");
    expect(header).toHaveClass("flex-col");
    expect(header).toHaveClass("space-y-2");
    expect(header).toHaveClass("text-center");
    expect(header).toHaveClass("sm:text-left");
  });

  test("SheetFooter renders correctly", () => {
    render(
      <SheetFooter className="test-class">
        <button>OK</button>
      </SheetFooter>
    );

    const footer = screen.getByText("OK").parentElement;
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass("test-class");
    expect(footer).toHaveClass("flex");
    expect(footer).toHaveClass("flex-col-reverse");
    expect(footer).toHaveClass("sm:flex-row");
    expect(footer).toHaveClass("sm:justify-end");
    expect(footer).toHaveClass("sm:space-x-2");
  });

  test("SheetTitle renders correctly", () => {
    render(<SheetTitle className="test-class">Sheet Title</SheetTitle>);

    const title = screen.getByTestId("sheet-title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass("test-class");
    expect(title).toHaveClass("text-foreground");
    expect(title).toHaveClass("text-lg");
    expect(title).toHaveClass("font-semibold");
    expect(screen.getByText("Sheet Title")).toBeInTheDocument();
  });

  test("SheetDescription renders correctly", () => {
    render(<SheetDescription className="test-class">Sheet Description</SheetDescription>);

    const description = screen.getByTestId("sheet-description");
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass("test-class");
    expect(description).toHaveClass("text-muted-foreground");
    expect(description).toHaveClass("text-sm");
    expect(screen.getByText("Sheet Description")).toBeInTheDocument();
  });

  test("SheetContent forwards props correctly", () => {
    render(
      <SheetContent data-testid="custom-sheet" aria-label="Custom Sheet">
        <div>Custom Content</div>
      </SheetContent>
    );

    const content = screen.getByTestId("custom-sheet");
    expect(content).toHaveAttribute("aria-label", "Custom Sheet");
  });

  test("SheetTitle forwards props correctly", () => {
    render(<SheetTitle data-testid="custom-title">Custom Title</SheetTitle>);

    const title = screen.getByTestId("custom-title");
    expect(title).toHaveAttribute("data-testid", "custom-title");
  });

  test("SheetDescription forwards props correctly", () => {
    render(<SheetDescription data-testid="custom-description">Custom Description</SheetDescription>);

    const description = screen.getByTestId("custom-description");
    expect(description).toHaveAttribute("data-testid", "custom-description");
  });

  test("SheetHeader forwards props correctly", () => {
    render(
      <SheetHeader data-testid="custom-header">
        <div>Header</div>
      </SheetHeader>
    );

    const header = screen.getByText("Header").parentElement;
    expect(header).toHaveAttribute("data-testid", "custom-header");
  });

  test("SheetFooter forwards props correctly", () => {
    render(
      <SheetFooter data-testid="custom-footer">
        <button>Footer</button>
      </SheetFooter>
    );

    const footer = screen.getByText("Footer").parentElement;
    expect(footer).toHaveAttribute("data-testid", "custom-footer");
  });

  test("SheetHeader handles dangerouslySetInnerHTML", () => {
    const htmlContent = "<span>Dangerous HTML</span>";
    render(<SheetHeader dangerouslySetInnerHTML={{ __html: htmlContent }} />);

    const header = document.querySelector(".flex.flex-col.space-y-2");
    expect(header).toBeInTheDocument();
    expect(header?.innerHTML).toContain(htmlContent);
  });

  test("SheetFooter handles dangerouslySetInnerHTML", () => {
    const htmlContent = "<span>Dangerous Footer HTML</span>";
    render(<SheetFooter dangerouslySetInnerHTML={{ __html: htmlContent }} />);

    const footer = document.querySelector(".flex.flex-col-reverse");
    expect(footer).toBeInTheDocument();
    expect(footer?.innerHTML).toContain(htmlContent);
  });

  test("All components export correctly", () => {
    expect(Sheet).toBeDefined();
    expect(SheetTrigger).toBeDefined();
    expect(SheetClose).toBeDefined();
    expect(SheetPortal).toBeDefined();
    expect(SheetOverlay).toBeDefined();
    expect(SheetContent).toBeDefined();
    expect(SheetHeader).toBeDefined();
    expect(SheetFooter).toBeDefined();
    expect(SheetTitle).toBeDefined();
    expect(SheetDescription).toBeDefined();
  });

  test("Components have correct displayName", () => {
    expect(SheetOverlay.displayName).toBe(SheetPrimitive.Overlay.displayName);
    expect(SheetContent.displayName).toBe(SheetPrimitive.Content.displayName);
    expect(SheetTitle.displayName).toBe(SheetPrimitive.Title.displayName);
    expect(SheetDescription.displayName).toBe(SheetPrimitive.Description.displayName);
    expect(SheetHeader.displayName).toBe("SheetHeader");
    expect(SheetFooter.displayName).toBe("SheetFooter");
  });

  test("Close button has accessibility attributes", () => {
    render(
      <SheetContent>
        <div>Content</div>
      </SheetContent>
    );

    const closeButton = screen.getByTestId("sheet-close");
    expect(closeButton).toHaveClass("focus:outline-none");
    expect(closeButton).toHaveClass("focus:ring-2");
    expect(closeButton).toHaveClass("focus:ring-offset-2");
    expect(closeButton).toHaveClass("disabled:pointer-events-none");

    // Check for screen reader text
    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.getByText("Close")).toHaveClass("sr-only");
  });

  test("SheetContent ref forwarding works", () => {
    const ref = vi.fn();
    render(
      <SheetContent ref={ref}>
        <div>Content</div>
      </SheetContent>
    );

    expect(ref).toHaveBeenCalled();
  });

  test("SheetTitle ref forwarding works", () => {
    const ref = vi.fn();
    render(<SheetTitle ref={ref}>Title</SheetTitle>);

    expect(ref).toHaveBeenCalled();
  });

  test("SheetDescription ref forwarding works", () => {
    const ref = vi.fn();
    render(<SheetDescription ref={ref}>Description</SheetDescription>);

    expect(ref).toHaveBeenCalled();
  });

  test("SheetOverlay ref forwarding works", () => {
    const ref = vi.fn();
    render(<SheetOverlay ref={ref} />);

    expect(ref).toHaveBeenCalled();
  });

  test("Full sheet example renders correctly", () => {
    render(
      <Sheet>
        <SheetTrigger>
          <span>Open Sheet</span>
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Sheet Title</SheetTitle>
            <SheetDescription>Sheet Description</SheetDescription>
          </SheetHeader>
          <div>Sheet Body Content</div>
          <SheetFooter>
            <button>Cancel</button>
            <button>Submit</button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    );

    expect(screen.getByTestId("sheet-root")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-portal")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-content")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-close")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-title")).toBeInTheDocument();
    expect(screen.getByTestId("sheet-description")).toBeInTheDocument();
    expect(screen.getByText("Open Sheet")).toBeInTheDocument();
    expect(screen.getByText("Sheet Title")).toBeInTheDocument();
    expect(screen.getByText("Sheet Description")).toBeInTheDocument();
    expect(screen.getByText("Sheet Body Content")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Submit")).toBeInTheDocument();
  });
});

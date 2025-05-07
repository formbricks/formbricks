import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./index";

// Mock Radix UI Dialog components
vi.mock("@radix-ui/react-dialog", () => {
  const Root = vi.fn(({ children }) => <div data-testid="dialog-root">{children}</div>) as any;
  Root.displayName = "DialogRoot";

  const Trigger = vi.fn(({ children }) => <button data-testid="dialog-trigger">{children}</button>) as any;
  Trigger.displayName = "DialogTrigger";

  const Portal = vi.fn(({ children }) => <div data-testid="dialog-portal">{children}</div>) as any;
  Portal.displayName = "DialogPortal";

  const Overlay = vi.fn(({ className, ...props }) => (
    <div data-testid="dialog-overlay" className={className} {...props} />
  )) as any;
  Overlay.displayName = "DialogOverlay";

  const Content = vi.fn(({ className, children, ...props }) => (
    <div data-testid="dialog-content" className={className} {...props}>
      {children}
    </div>
  )) as any;
  Content.displayName = "DialogContent";

  const Close = vi.fn(({ className, children }) => (
    <button data-testid="dialog-close" className={className}>
      {children}
    </button>
  )) as any;
  Close.displayName = "DialogClose";

  const Title = vi.fn(({ className, children, ...props }) => (
    <h2 data-testid="dialog-title" className={className} {...props}>
      {children}
    </h2>
  )) as any;
  Title.displayName = "DialogTitle";

  const Description = vi.fn(({ className, children, ...props }) => (
    <p data-testid="dialog-description" className={className} {...props}>
      {children}
    </p>
  )) as any;
  Description.displayName = "DialogDescription";

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
  X: () => <div data-testid="x-icon">X Icon</div>,
}));

describe("Dialog Components", () => {
  afterEach(() => {
    cleanup();
  });

  test("Dialog renders correctly", () => {
    render(
      <Dialog>
        <div>Dialog Content</div>
      </Dialog>
    );

    expect(screen.getByTestId("dialog-root")).toBeInTheDocument();
    expect(screen.getByText("Dialog Content")).toBeInTheDocument();
  });

  test("DialogTrigger renders correctly", () => {
    render(
      <DialogTrigger>
        <span>Open Dialog</span>
      </DialogTrigger>
    );

    expect(screen.getByTestId("dialog-trigger")).toBeInTheDocument();
    expect(screen.getByText("Open Dialog")).toBeInTheDocument();
  });

  test("DialogContent renders with children", () => {
    render(
      <DialogContent>
        <div>Test Content</div>
      </DialogContent>
    );

    expect(screen.getByTestId("dialog-portal")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-content")).toBeInTheDocument();
    expect(screen.getByTestId("dialog-close")).toBeInTheDocument();
    expect(screen.getByText("Test Content")).toBeInTheDocument();
  });

  test("DialogContent hides close button when hideCloseButton is true", () => {
    render(
      <DialogContent hideCloseButton>
        <div>Test Content</div>
      </DialogContent>
    );

    expect(screen.getByTestId("dialog-close")).toBeInTheDocument();
    expect(screen.queryByTestId("x-icon")).not.toBeInTheDocument();
  });

  test("DialogContent shows close button by default", () => {
    render(
      <DialogContent>
        <div>Test Content</div>
      </DialogContent>
    );

    expect(screen.getByTestId("dialog-close")).toBeInTheDocument();
    expect(screen.getByTestId("x-icon")).toBeInTheDocument();
  });

  test("DialogHeader renders correctly", () => {
    render(
      <DialogHeader className="test-class">
        <div>Header Content</div>
      </DialogHeader>
    );

    const header = screen.getByText("Header Content").parentElement;
    expect(header).toBeInTheDocument();
    expect(header).toHaveClass("test-class");
    expect(header).toHaveClass("flex");
    expect(header).toHaveClass("flex-col");
  });

  test("DialogFooter renders correctly", () => {
    render(
      <DialogFooter className="test-class">
        <button>OK</button>
      </DialogFooter>
    );

    const footer = screen.getByText("OK").parentElement;
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass("test-class");
    expect(footer).toHaveClass("flex");
  });

  test("DialogTitle renders correctly", () => {
    render(<DialogTitle className="test-class">Dialog Title</DialogTitle>);

    const title = screen.getByTestId("dialog-title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveClass("test-class");
    expect(screen.getByText("Dialog Title")).toBeInTheDocument();
  });

  test("DialogDescription renders correctly", () => {
    render(<DialogDescription className="test-class">Dialog Description</DialogDescription>);

    const description = screen.getByTestId("dialog-description");
    expect(description).toBeInTheDocument();
    expect(description).toHaveClass("test-class");
    expect(screen.getByText("Dialog Description")).toBeInTheDocument();
  });

  test("DialogHeader handles dangerouslySetInnerHTML", () => {
    const htmlContent = "<span>Dangerous HTML</span>";
    render(<DialogHeader dangerouslySetInnerHTML={{ __html: htmlContent }} />);

    const header = document.querySelector(".flex.flex-col");
    expect(header).toBeInTheDocument();
    expect(header?.innerHTML).toContain(htmlContent);
  });

  test("DialogFooter handles dangerouslySetInnerHTML", () => {
    const htmlContent = "<span>Dangerous Footer HTML</span>";
    render(<DialogFooter dangerouslySetInnerHTML={{ __html: htmlContent }} />);

    const footer = document.querySelector(".flex.flex-col-reverse");
    expect(footer).toBeInTheDocument();
    expect(footer?.innerHTML).toContain(htmlContent);
  });

  test("All components export correctly", () => {
    expect(Dialog).toBeDefined();
    expect(DialogTrigger).toBeDefined();
    expect(DialogContent).toBeDefined();
    expect(DialogHeader).toBeDefined();
    expect(DialogFooter).toBeDefined();
    expect(DialogTitle).toBeDefined();
    expect(DialogDescription).toBeDefined();
  });

  test("Components have correct displayName", () => {
    expect(DialogContent.displayName).toBe(DialogPrimitive.Content.displayName);
    expect(DialogTitle.displayName).toBe(DialogPrimitive.Title.displayName);
    expect(DialogDescription.displayName).toBe(DialogPrimitive.Description.displayName);
    expect(DialogHeader.displayName).toBe("DialogHeader");
    expect(DialogFooter.displayName).toBe("DialogFooter");
  });
});

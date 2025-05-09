import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { Tooltip, TooltipContent, TooltipProvider, TooltipRenderer, TooltipTrigger } from "./index";

// Mock radix-ui tooltip
vi.mock("@radix-ui/react-tooltip", () => ({
  Root: ({ children, ...props }: any) => (
    <div data-testid="tooltip-root" {...props}>
      {children}
    </div>
  ),
  Provider: ({ children, ...props }: any) => (
    <div data-testid="tooltip-provider" {...props}>
      {children}
    </div>
  ),
  Trigger: ({ children, asChild, ...props }: any) => (
    <div data-testid="tooltip-trigger" data-as-child={asChild} {...props}>
      {children}
    </div>
  ),
  Content: ({ children, sideOffset, className, ...props }: any) => (
    <div data-testid="tooltip-content" data-side-offset={sideOffset} className={className} {...props}>
      {children}
    </div>
  ),
  Tooltip: ({ children, ...props }: any) => (
    <div data-testid="tooltip" {...props}>
      {children}
    </div>
  ),
}));

describe("Tooltip", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders basic tooltip components", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    expect(screen.getByTestId("tooltip-provider")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-root")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-trigger")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();

    expect(screen.getByText("Hover me")).toBeInTheDocument();
    expect(screen.getByText("Tooltip content")).toBeInTheDocument();
  });

  test("applies correct default classes to TooltipContent", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const contentElement = screen.getByTestId("tooltip-content");
    expect(contentElement).toHaveClass("animate-in");
    expect(contentElement).toHaveClass("fade-in-50");
    expect(contentElement).toHaveClass("z-50");
    expect(contentElement).toHaveClass("rounded-md");
    expect(contentElement).toHaveClass("border");
    expect(contentElement).toHaveClass("border-slate-100");
    expect(contentElement).toHaveClass("bg-white");
  });

  test("applies custom classes to TooltipContent", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent className="custom-class">Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const contentElement = screen.getByTestId("tooltip-content");
    expect(contentElement).toHaveClass("custom-class");
  });

  test("accepts custom sideOffset prop", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent sideOffset={10}>Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const contentElement = screen.getByTestId("tooltip-content");
    expect(contentElement).toHaveAttribute("data-side-offset", "10");
  });

  test("uses default sideOffset when not provided", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const contentElement = screen.getByTestId("tooltip-content");
    expect(contentElement).toHaveAttribute("data-side-offset", "4");
  });

  test("sets asChild prop on trigger", () => {
    render(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button>Click me</button>
          </TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    const triggerElement = screen.getByTestId("tooltip-trigger");
    expect(triggerElement).toHaveAttribute("data-as-child", "true");
  });
});

describe("TooltipRenderer", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders tooltip with content", () => {
    render(
      <TooltipRenderer tooltipContent="Tooltip text" className="test-class">
        <button>Trigger</button>
      </TooltipRenderer>
    );

    expect(screen.getByText("Trigger")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toBeInTheDocument();
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Tooltip text");
    expect(screen.getByTestId("tooltip-content")).toHaveClass("test-class");
  });

  test("applies triggerClass to the trigger wrapper", () => {
    render(
      <TooltipRenderer tooltipContent="Tooltip text" triggerClass="trigger-class">
        <button>Trigger</button>
      </TooltipRenderer>
    );

    const trigger = screen.getByTestId("tooltip-trigger").firstChild;
    expect(trigger).toHaveClass("trigger-class");
  });

  test("doesn't render tooltip when shouldRender is false", () => {
    render(
      <TooltipRenderer tooltipContent="Tooltip text" shouldRender={false}>
        <button>Trigger</button>
      </TooltipRenderer>
    );

    expect(screen.getByText("Trigger")).toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-provider")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });

  test("renders tooltip with React node as content", () => {
    render(
      <TooltipRenderer
        tooltipContent={
          <div>
            Complex tooltip <strong>content</strong>
          </div>
        }>
        <button>Trigger</button>
      </TooltipRenderer>
    );

    const tooltipContent = screen.getByTestId("tooltip-content");
    expect(tooltipContent).toBeInTheDocument();
    expect(tooltipContent.innerHTML).toContain("Complex tooltip ");
    expect(tooltipContent.innerHTML).toContain("<strong>content</strong>");
  });
});

import * as Sentry from "@sentry/nextjs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import ErrorBoundary from "./error";

vi.mock("@/modules/ui/components/button", () => ({
  Button: (props: any) => <button {...props}>{props.children}</button>,
}));

vi.mock("@/modules/ui/components/error-component", () => ({
  ErrorComponent: ({ title, description }: { title: string; description: string }) => (
    <div data-testid="ErrorComponent">
      <div data-testid="error-title">{title}</div>
      <div data-testid="error-description">{description}</div>
    </div>
  ),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

vi.mock("@tolgee/react", () => ({
  useTranslate: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "common.error_rate_limit_title": "Too Many Requests",
        "common.error_rate_limit_description": "You're making too many requests. Please slow down.",
        "common.error_component_title": "Something went wrong",
        "common.error_component_description": "An unexpected error occurred. Please try again.",
        "common.try_again": "Try Again",
        "common.go_to_dashboard": "Go to Dashboard",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("@formbricks/types/errors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@formbricks/types/errors")>();
  return {
    ...actual,
    getClientErrorData: vi.fn(),
  };
});

describe("ErrorBoundary", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const dummyError = new Error("Test error");
  const resetMock = vi.fn();

  test("logs error via console.error in development", async () => {
    (process.env as { [key: string]: string }).NODE_ENV = "development";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(Sentry.captureException).mockImplementation((() => {}) as any);

    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      type: "general",
      showButtons: true,
    });

    render(<ErrorBoundary error={dummyError} reset={resetMock} />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Test error");
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("captures error with Sentry in production", async () => {
    (process.env as { [key: string]: string }).NODE_ENV = "production";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(Sentry.captureException).mockImplementation((() => {}) as any);

    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      type: "general",
      showButtons: true,
    });

    render(<ErrorBoundary error={dummyError} reset={resetMock} />);

    await waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalled();
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  test("calls reset when try again button is clicked for general errors", async () => {
    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      type: "general",
      showButtons: true,
    });

    render(<ErrorBoundary error={{ ...dummyError }} reset={resetMock} />);
    const tryAgainBtn = screen.getByRole("button", { name: "Try Again" });
    userEvent.click(tryAgainBtn);
    await waitFor(() => expect(resetMock).toHaveBeenCalled());
  });

  test("sets window.location.href to '/' when dashboard button is clicked for general errors", async () => {
    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      type: "general",
      showButtons: true,
    });

    const originalLocation = window.location;
    (window as any).location = undefined;
    (window as any).location = { href: "" };
    render(<ErrorBoundary error={{ ...dummyError }} reset={resetMock} />);
    const dashBtn = screen.getByRole("button", { name: "Go to Dashboard" });
    userEvent.click(dashBtn);
    await waitFor(() => {
      expect(window.location.href).toBe("/");
    });
    (window as any).location = originalLocation;
  });

  test("does not show buttons for rate limit errors", async () => {
    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      type: "rate_limit",
      showButtons: false,
    });

    render(<ErrorBoundary error={{ ...dummyError }} reset={resetMock} />);

    expect(screen.queryByRole("button", { name: "Try Again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go to Dashboard" })).not.toBeInTheDocument();
  });

  test("shows error component with rate limit messages for rate limit errors", async () => {
    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      type: "rate_limit",
      showButtons: false,
    });

    render(<ErrorBoundary error={dummyError} reset={resetMock} />);

    expect(screen.getByTestId("ErrorComponent")).toBeInTheDocument();
    expect(screen.getByTestId("error-title")).toHaveTextContent("Too Many Requests");
    expect(screen.getByTestId("error-description")).toHaveTextContent(
      "You're making too many requests. Please slow down."
    );
    expect(getClientErrorData).toHaveBeenCalledWith(dummyError);
  });

  test("shows error component with general messages for general errors", async () => {
    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      type: "general",
      showButtons: true,
    });

    render(<ErrorBoundary error={dummyError} reset={resetMock} />);

    expect(screen.getByTestId("ErrorComponent")).toBeInTheDocument();
    expect(screen.getByTestId("error-title")).toHaveTextContent("Something went wrong");
    expect(screen.getByTestId("error-description")).toHaveTextContent(
      "An unexpected error occurred. Please try again."
    );
    expect(getClientErrorData).toHaveBeenCalledWith(dummyError);
  });

  test("shows buttons for general errors", async () => {
    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      type: "general",
      showButtons: true,
    });

    render(<ErrorBoundary error={dummyError} reset={resetMock} />);

    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Dashboard" })).toBeInTheDocument();
  });
});

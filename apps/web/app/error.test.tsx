import * as Sentry from "@sentry/nextjs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import ErrorBoundary from "./error";

vi.mock("@/modules/ui/components/button", () => ({
  Button: (props: any) => <button {...props}>{props.children}</button>,
}));

vi.mock("@/modules/ui/components/error-component", () => ({
  ErrorComponent: () => <div data-testid="ErrorComponent">ErrorComponent</div>,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
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
      title: "Something went wrong",
      description: "An unexpected error occurred. Please try again.",
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
      title: "Something went wrong",
      description: "An unexpected error occurred. Please try again.",
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
      title: "Something went wrong",
      description: "An unexpected error occurred. Please try again.",
      showButtons: true,
    });

    render(<ErrorBoundary error={{ ...dummyError }} reset={resetMock} />);
    const tryAgainBtn = screen.getByRole("button", { name: "common.try_again" });
    userEvent.click(tryAgainBtn);
    await waitFor(() => expect(resetMock).toHaveBeenCalled());
  });

  test("sets window.location.href to '/' when dashboard button is clicked for general errors", async () => {
    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      title: "Something went wrong",
      description: "An unexpected error occurred. Please try again.",
      showButtons: true,
    });

    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: "" };
    render(<ErrorBoundary error={{ ...dummyError }} reset={resetMock} />);
    const dashBtn = screen.getByRole("button", { name: "common.go_to_dashboard" });
    userEvent.click(dashBtn);
    await waitFor(() => {
      expect(window.location.href).toBe("/");
    });
    (window as any).location = originalLocation;
  });

  test("does not show buttons for rate limit errors", async () => {
    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      title: "common.error_rate_limit_title",
      description: "common.error_rate_limit_description",
      showButtons: false,
    });

    render(<ErrorBoundary error={{ ...dummyError }} reset={resetMock} />);

    expect(screen.queryByRole("button", { name: "common.try_again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "common.go_to_dashboard" })).not.toBeInTheDocument();
  });

  test("shows error component with custom title and description for rate limit errors", async () => {
    const { getClientErrorData } = await import("@formbricks/types/errors");
    vi.mocked(getClientErrorData).mockReturnValue({
      title: "common.error_rate_limit_title",
      description: "common.error_rate_limit_description",
      showButtons: false,
    });

    render(<ErrorBoundary error={dummyError} reset={resetMock} />);

    expect(screen.getByTestId("ErrorComponent")).toBeInTheDocument();
    expect(getClientErrorData).toHaveBeenCalledWith(dummyError);
  });
});

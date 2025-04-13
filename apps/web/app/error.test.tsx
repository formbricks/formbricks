import * as Sentry from "@sentry/nextjs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
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

describe("ErrorBoundary", () => {
  afterEach(() => {
    cleanup();
  });

  const dummyError = new Error("Test error");
  const resetMock = vi.fn();

  it("logs error via console.error in development", async () => {
    (process.env as { [key: string]: string }).NODE_ENV = "development";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(Sentry.captureException).mockImplementation((() => {}) as any);

    render(<ErrorBoundary error={dummyError} reset={resetMock} />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Test error");
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("captures error with Sentry in production", async () => {
    (process.env as { [key: string]: string }).NODE_ENV = "production";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(Sentry.captureException).mockImplementation((() => {}) as any);

    render(<ErrorBoundary error={{ ...dummyError }} reset={resetMock} />);

    await waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalled();
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });

  it("calls reset when try again button is clicked", async () => {
    render(<ErrorBoundary error={{ ...dummyError }} reset={resetMock} />);
    const tryAgainBtn = screen.getByRole("button", { name: "common.try_again" });
    userEvent.click(tryAgainBtn);
    await waitFor(() => expect(resetMock).toHaveBeenCalled());
  });

  it("sets window.location.href to '/' when dashboard button is clicked", async () => {
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { href: "" };
    render(<ErrorBoundary error={{ ...dummyError }} reset={resetMock} />);
    const dashBtn = screen.getByRole("button", { name: "common.go_to_dashboard" });
    userEvent.click(dashBtn);
    await waitFor(() => {
      expect(window.location.href).toBe("/");
    });
    window.location = originalLocation;
  });
});

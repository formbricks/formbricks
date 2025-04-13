import * as Sentry from "@sentry/nextjs";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalError from "./global-error";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

describe("GlobalError", () => {
  const dummyError = new Error("Test error");
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    cleanup();
  });

  it("logs error using console.error in development", async () => {
    (process.env as { [key: string]: string }).NODE_ENV = "development";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(Sentry.captureException).mockImplementation((() => {}) as any);

    render(<GlobalError error={dummyError} />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith("Test error");
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it("captures error with Sentry in production", async () => {
    (process.env as { [key: string]: string }).NODE_ENV = "production";
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(<GlobalError error={dummyError} />);

    await waitFor(() => {
      expect(Sentry.captureException).toHaveBeenCalled();
    });
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});

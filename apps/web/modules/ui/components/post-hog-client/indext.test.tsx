import { cleanup, render, waitFor } from "@testing-library/react";
import posthog, { CaptureResult } from "posthog-js";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { PHProvider, PostHogPageview } from "./index";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/test"),
  useSearchParams: vi.fn(() => new URLSearchParams("foo=bar")),
}));

// Ensure window.origin is defined (JSDOM may not have it)
Object.defineProperty(window, "origin", {
  value: "http://localhost",
  writable: true,
});

describe("PostHogPageview", () => {
  beforeEach(() => {
    cleanup();
  });

  test("does not initialize or capture when posthogEnabled is false", async () => {
    let captureResult: CaptureResult = { uuid: "test-uuid", event: "$pageview", properties: {} };
    const initSpy = vi.spyOn(posthog, "init").mockImplementation(() => posthog);
    const captureSpy = vi.spyOn(posthog, "capture").mockImplementation(() => captureResult);

    render(<PostHogPageview posthogEnabled={false} />);

    await waitFor(() => {
      expect(initSpy).not.toHaveBeenCalled();
      expect(captureSpy).not.toHaveBeenCalled();
    });
  });

  test("logs an error if postHogApiHost is missing", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PostHogPageview posthogEnabled={true} postHogApiKey="test-key" />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorArg = consoleErrorSpy.mock.calls[0][1];
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg.message).toBe("Posthog API host is required");
    });
  });

  test("logs an error if postHogApiKey is missing", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PostHogPageview posthogEnabled={true} postHogApiHost="test-host" />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
      const errorArg = consoleErrorSpy.mock.calls[0][1];
      expect(errorArg).toBeInstanceOf(Error);
      expect(errorArg.message).toBe("Posthog key is required");
    });
  });

  test("initializes posthog and captures a pageview when enabled and credentials are provided", async () => {
    let captureResult: CaptureResult = { uuid: "test-uuid", event: "$pageview", properties: {} };
    const initSpy = vi.spyOn(posthog, "init").mockImplementation(() => posthog);
    const captureSpy = vi.spyOn(posthog, "capture").mockImplementation(() => captureResult);

    render(<PostHogPageview posthogEnabled={true} postHogApiHost="test-host" postHogApiKey="test-key" />);

    await waitFor(() => {
      expect(initSpy).toHaveBeenCalledWith("test-key", { api_host: "test-host" });
      // With our mocked hooks and window.origin, the expected URL is:
      // "http://localhost" + "/test" + "?foo=bar"
      expect(captureSpy).toHaveBeenCalledWith("$pageview", {
        $current_url: "http://localhost/test?foo=bar",
      });
    });
  });
});

describe("PHProvider", () => {
  beforeEach(() => {
    cleanup();
  });

  test("wraps children with PostHogProvider when posthogEnabled is true", () => {
    // Here we simply verify that the children are rendered.
    // The PostHogProvider from "posthog-js/react" acts as a context provider
    // so we verify that our children appear in the output.
    const Child = () => <div>Child Content</div>;
    const { getByText } = render(
      <PHProvider posthogEnabled={true}>
        <Child />
      </PHProvider>
    );
    expect(getByText("Child Content")).toBeInTheDocument();
  });

  test("renders children directly when posthogEnabled is false", () => {
    const Child = () => <div>Child Content</div>;
    const { getByText } = render(
      <PHProvider posthogEnabled={false}>
        <Child />
      </PHProvider>
    );
    expect(getByText("Child Content")).toBeInTheDocument();
  });
});

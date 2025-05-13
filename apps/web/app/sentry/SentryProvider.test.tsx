import * as Sentry from "@sentry/nextjs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SentryProvider } from "./SentryProvider";

vi.mock("@sentry/nextjs", async () => {
  const actual = await vi.importActual<typeof import("@sentry/nextjs")>("@sentry/nextjs");
  return {
    ...actual,
    replayIntegration: (options: any) => {
      return {
        name: "Replay",
        id: "Replay",
        options,
      };
    },
  };
});

const sentryDsn = "https://examplePublicKey@o0.ingest.sentry.io/0";

describe("SentryProvider", () => {
  afterEach(() => {
    cleanup();
  });

  test("calls Sentry.init when sentryDsn is provided", () => {
    const initSpy = vi.spyOn(Sentry, "init").mockImplementation(() => undefined);

    render(
      <SentryProvider sentryDsn={sentryDsn} isEnabled>
        <div data-testid="child">Test Content</div>
      </SentryProvider>
    );

    // The useEffect runs after mount, so Sentry.init should have been called.
    expect(initSpy).toHaveBeenCalled();
    expect(initSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        dsn: sentryDsn,
        tracesSampleRate: 0,
        debug: false,
        replaysOnErrorSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        integrations: expect.any(Array),
        beforeSend: expect.any(Function),
      })
    );
  });

  test("does not call Sentry.init when sentryDsn is not provided", () => {
    const initSpy = vi.spyOn(Sentry, "init").mockImplementation(() => undefined);

    render(
      <SentryProvider>
        <div data-testid="child">Test Content</div>
      </SentryProvider>
    );

    expect(initSpy).not.toHaveBeenCalled();
  });

  test("does not call Sentry.init when isEnabled is not provided", () => {
    const initSpy = vi.spyOn(Sentry, "init").mockImplementation(() => undefined);

    render(
      <SentryProvider sentryDsn={sentryDsn}>
        <div data-testid="child">Test Content</div>
      </SentryProvider>
    );

    expect(initSpy).not.toHaveBeenCalled();
  });

  test("renders children", () => {
    render(
      <SentryProvider sentryDsn={sentryDsn} isEnabled>
        <div data-testid="child">Test Content</div>
      </SentryProvider>
    );
    expect(screen.getByTestId("child")).toHaveTextContent("Test Content");
  });

  test("processes beforeSend correctly", () => {
    const initSpy = vi.spyOn(Sentry, "init").mockImplementation(() => undefined);

    render(
      <SentryProvider sentryDsn={sentryDsn} isEnabled>
        <div data-testid="child">Test Content</div>
      </SentryProvider>
    );

    const config = initSpy.mock.calls[0][0];
    expect(config).toHaveProperty("beforeSend");
    const beforeSend = config.beforeSend;

    if (!beforeSend) {
      throw new Error("beforeSend is not defined");
    }

    const dummyEvent = { some: "event" } as unknown as Sentry.ErrorEvent;

    const hintWithNextNotFound = { originalException: { digest: "NEXT_NOT_FOUND" } };
    expect(beforeSend(dummyEvent, hintWithNextNotFound)).toBeNull();

    const hintWithOtherError = { originalException: { digest: "OTHER_ERROR" } };
    expect(beforeSend(dummyEvent, hintWithOtherError)).toEqual(dummyEvent);

    const hintWithoutError = { originalException: undefined };
    expect(beforeSend(dummyEvent, hintWithoutError)).toEqual(dummyEvent);
  });
});

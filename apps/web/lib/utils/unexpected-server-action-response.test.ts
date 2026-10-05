// @vitest-environment jsdom
import Module, { createRequire } from "node:module";
import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  isUnexpectedServerActionResponseError,
  registerUnexpectedServerActionResponseListener,
} from "@/lib/utils/unexpected-server-action-response";

/**
 * Drives Next.js's own client-side server-action reducer against a stubbed `fetch`, so the rejection
 * under test is the one the installed Next.js really produces -- not a hand-built copy of it. If an
 * upgrade renames the error code or moves the throw, these tests fail instead of the notice silently
 * going dark (ENG-2899).
 *
 * Two pieces of bundler wiring have to be recreated for the reducer to load outside a Next.js build:
 * Next.js resolves `react-server-dom-webpack/client` to its own compiled copy, and that copy reads the
 * webpack runtime globals at module load. Both are scoped to this file and undone in `afterAll`.
 */
const require = createRequire(import.meta.url);
type TResolveFilename = (request: string, ...rest: unknown[]) => string;
const moduleWithResolver = Module as unknown as { _resolveFilename: TResolveFilename };
const originalResolveFilename = moduleWithResolver._resolveFilename;

type TServerActionReducer = (
  state: Record<string, unknown>,
  action: Record<string, unknown>
) => Promise<unknown> | unknown;
let serverActionReducer: TServerActionReducer;

beforeAll(() => {
  moduleWithResolver._resolveFilename = function (request, ...rest) {
    const aliased =
      request === "react-server-dom-webpack/client"
        ? "next/dist/compiled/react-server-dom-webpack/client"
        : request;
    return originalResolveFilename.call(this, aliased, ...rest);
  };
  vi.stubGlobal(
    "__webpack_require__",
    Object.assign(() => ({}), { u: () => "" })
  );
  vi.stubGlobal("__webpack_chunk_load__", () => Promise.resolve());

  ({
    serverActionReducer,
  } = require("next/dist/client/components/router-reducer/reducers/server-action-reducer"));
});

afterAll(() => {
  moduleWithResolver._resolveFilename = originalResolveFilename;
  vi.unstubAllGlobals();
});

/** Invokes a server action through the real reducer, answering its POST with `response`. */
const rejectionFor = async (response: Response): Promise<unknown> => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(response))
  );

  return new Promise((settle) => {
    const action = {
      actionId: "7f".padEnd(42, "0"),
      actionArgs: [{ surveyId: "survey-1" }],
      resolve: () => settle(undefined),
      reject: settle,
      didRevalidate: false,
    };
    const state = {
      canonicalUrl: "/workspaces/w1/surveys/s1/edit",
      tree: ["", { children: ["__PAGE__", {}] }, null, null, true],
      nextUrl: null,
      previousNextUrl: null,
    };

    Promise.resolve(serverActionReducer(state, action)).catch(settle);
  });
};

describe("isUnexpectedServerActionResponseError", () => {
  test.each([
    [
      "a load balancer's 502 page",
      new Response("<html>502 Bad Gateway</html>", {
        status: 502,
        headers: { "content-type": "text/html" },
      }),
    ],
    [
      "a gateway timeout page",
      new Response("<html>504</html>", {
        status: 504,
        headers: { "content-type": "text/html" },
      }),
    ],
    ["an empty, untyped body", new Response("", { status: 200 })],
    [
      "a JSON error from a proxy",
      new Response("{}", {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    ],
  ])("recognizes the rejection Next.js raises for %s", async (_label, response) => {
    const rejection = await rejectionFor(response);

    expect(rejection).toBeInstanceOf(Error);
    expect((rejection as Error).message).toBe("An unexpected response was received from the server.");
    expect(isUnexpectedServerActionResponseError(rejection)).toBe(true);
  });

  test("recognizes it when Next.js uses the server's own text as the message", async () => {
    // A 4xx/5xx `text/plain` body becomes the message, which is why the code is matched, not the text.
    const rejection = await rejectionFor(
      new Response("upstream connect error", { status: 503, headers: { "content-type": "text/plain" } })
    );

    expect((rejection as Error).message).toBe("upstream connect error");
    expect(isUnexpectedServerActionResponseError(rejection)).toBe(true);
  });

  test("leaves a stale action to the reload prompt", async () => {
    const rejection = await rejectionFor(
      new Response("Server action not found.", {
        status: 404,
        headers: { "content-type": "text/plain", "x-nextjs-action-not-found": "1" },
      })
    );

    // Same transport, different failure: the bundle is out of date, and `StaleDeploymentPrompt` owns it.
    expect((rejection as Error).name).toBe("UnrecognizedActionError");
    expect(isUnexpectedServerActionResponseError(rejection)).toBe(false);
  });

  test("rejects anything that does not carry the framework's code", () => {
    const impostor = new Error("An unexpected response was received from the server.");

    expect(isUnexpectedServerActionResponseError(impostor)).toBe(false);
    expect(isUnexpectedServerActionResponseError({ __NEXT_ERROR_CODE: "E394" })).toBe(false);
    expect(
      isUnexpectedServerActionResponseError(Object.assign(new Error("x"), { __NEXT_ERROR_CODE: "E715" }))
    ).toBe(false);
    expect(isUnexpectedServerActionResponseError("E394")).toBe(false);
    expect(isUnexpectedServerActionResponseError(undefined)).toBe(false);
  });
});

describe("registerUnexpectedServerActionResponseListener", () => {
  const unsubscribers: Array<() => void> = [];

  afterEach(() => {
    unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  });

  /** jsdom has no `PromiseRejectionEvent`, so this builds the same shape the browser dispatches. */
  const dispatchUnhandledRejection = (reason: unknown) => {
    const event = Object.assign(new Event("unhandledrejection", { cancelable: true }), { reason });
    window.dispatchEvent(event);
    return event;
  };

  const unexpectedResponseError = () =>
    Object.assign(new Error("An unexpected response was received from the server."), {
      __NEXT_ERROR_CODE: "E394",
    });

  test("reports an unexpected-response rejection nothing else handled", () => {
    const onFailure = vi.fn();
    unsubscribers.push(registerUnexpectedServerActionResponseListener(onFailure));

    dispatchUnhandledRejection(unexpectedResponseError());

    expect(onFailure).toHaveBeenCalledTimes(1);
  });

  test("keeps the rejection unhandled so the console and Sentry still see it", () => {
    unsubscribers.push(registerUnexpectedServerActionResponseListener(vi.fn()));

    const event = dispatchUnhandledRejection(unexpectedResponseError());

    expect(event.defaultPrevented).toBe(false);
  });

  test("reports every occurrence, not just the first", () => {
    const onFailure = vi.fn();
    unsubscribers.push(registerUnexpectedServerActionResponseListener(onFailure));

    dispatchUnhandledRejection(unexpectedResponseError());
    dispatchUnhandledRejection(unexpectedResponseError());

    expect(onFailure).toHaveBeenCalledTimes(2);
  });

  test("ignores every other rejection", () => {
    const onFailure = vi.fn();
    unsubscribers.push(registerUnexpectedServerActionResponseListener(onFailure));

    dispatchUnhandledRejection(new Error("boom"));
    dispatchUnhandledRejection(Object.assign(new Error("stale"), { __NEXT_ERROR_CODE: "E715" }));

    expect(onFailure).not.toHaveBeenCalled();
  });

  test("stops reporting once unsubscribed", () => {
    const onFailure = vi.fn();
    registerUnexpectedServerActionResponseListener(onFailure)();

    dispatchUnhandledRejection(unexpectedResponseError());

    expect(onFailure).not.toHaveBeenCalled();
  });
});

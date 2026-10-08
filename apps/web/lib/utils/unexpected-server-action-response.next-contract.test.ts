// @vitest-environment jsdom
import Module, { createRequire } from "node:module";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { isUnexpectedServerActionResponseError } from "@/lib/utils/unexpected-server-action-response";

/**
 * Contract test against the installed Next.js (ENG-2899).
 *
 * `isUnexpectedServerActionResponseError` relies on two things Next.js does not document: the `E394`
 * code it stamps on an action's non-Flight response, and the absence of a `digest` on that error.
 * There is no public boundary that produces this rejection short of a full browser run, so this file
 * deliberately drives Next's own client-side server-action reducer with a stubbed `fetch`. That makes
 * it a canary: if an upgrade renames the code, adds a digest, or moves the throw, this file fails and
 * points here -- instead of the notice silently going dark in production. The classifier's own
 * behaviour is unit-tested with fixtures in `unexpected-server-action-response.test.ts`.
 *
 * Two pieces of bundler wiring are recreated so the reducer loads outside a Next.js build: Next.js
 * resolves `react-server-dom-webpack/client` to its compiled copy, and that copy reads the webpack
 * runtime globals at load. Both are scoped to this file and undone in `afterAll`.
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

describe("Next.js server-action rejections, as the installed version raises them", () => {
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
  ])("an action answered with %s is recognized", async (_label, response) => {
    const rejection = await rejectionFor(response);

    // The shape the classifier and its unit-test fixtures rely on.
    expect(rejection).toBeInstanceOf(Error);
    expect(rejection).toMatchObject({ __NEXT_ERROR_CODE: "E394" });
    expect(rejection).not.toHaveProperty("digest");
    expect(isUnexpectedServerActionResponseError(rejection)).toBe(true);
  });

  test("a 4xx/5xx text/plain body becomes the message and is still recognized", async () => {
    const rejection = await rejectionFor(
      new Response("upstream connect error", { status: 503, headers: { "content-type": "text/plain" } })
    );

    expect((rejection as Error).message).toBe("upstream connect error");
    expect(isUnexpectedServerActionResponseError(rejection)).toBe(true);
  });

  test("a stale action is left to the reload prompt", async () => {
    const rejection = await rejectionFor(
      new Response("Server action not found.", {
        status: 404,
        headers: { "content-type": "text/plain", "x-nextjs-action-not-found": "1" },
      })
    );

    expect((rejection as Error).name).toBe("UnrecognizedActionError");
    expect(isUnexpectedServerActionResponseError(rejection)).toBe(false);
  });

  test("an action's redirect() is not mistaken for one, though it shares the code", () => {
    // The real error a redirecting action rejects with: E394 too, but with a digest.
    const { getRedirectError } = require("next/dist/client/components/redirect");
    const redirect = getRedirectError("/workspaces/w1/surveys", "push");

    expect(redirect.__NEXT_ERROR_CODE).toBe("E394");
    expect(redirect).toHaveProperty("digest");
    expect(isUnexpectedServerActionResponseError(redirect)).toBe(false);
  });
});

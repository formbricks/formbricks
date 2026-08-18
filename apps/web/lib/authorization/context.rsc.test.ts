import { after } from "next/server";
import * as React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getAuthorizationSurface,
  getIssuedAuthorizationCheckCount,
  recordAuthorizationCheckIssued,
  withAuthorizationSurface,
} from "./context";
import { recordAuthorizationChecksPerRequest } from "./metrics";

/**
 * ENG-2444 — the `page` surface under a real React request scope.
 *
 * This file exists because the `unit` project cannot cover the fix at all: the default build of React
 * ships `cache` as a permanent no-op (`return fn.apply(null, arguments)`), so the slot the `page`
 * surface lives in never memoizes there and the surface silently falls back to the old async-scoped
 * boundary. Only the react-server build implements `cache`, which is why these run in the `rsc`
 * Vitest project (see vite.config.mts).
 *
 * The request scope is installed directly rather than by running a renderer: React's `cache` reads
 * `ReactSharedInternals.A` and calls `getCacheForType` on it, and that is the entire contract Next.js
 * satisfies per request. Installing it here exercises React's REAL `cache` implementation — what is
 * substituted is the request boundary Next would provide, not the behaviour under test.
 */
const reactServerInternals = (
  React as unknown as {
    __SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { A: unknown };
  }
).__SERVER_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;

/** One React request scope, the shape Next.js establishes around a render. */
const enterRequestScope = (): void => {
  const roots = new Map<() => unknown, unknown>();
  reactServerInternals.A = {
    getCacheForType<T>(resourceType: () => T): T {
      if (!roots.has(resourceType)) roots.set(resourceType, resourceType());
      return roots.get(resourceType) as T;
    },
  };
};

const leaveRequestScope = (): void => {
  reactServerInternals.A = null;
};

const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void> | void>);

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<void> | void) => afterCallbacks.push(callback)),
}));
vi.mock("./metrics", () => ({ recordAuthorizationChecksPerRequest: vi.fn() }));

beforeEach(() => {
  afterCallbacks.length = 0;
  leaveRequestScope();
  vi.mocked(recordAuthorizationChecksPerRequest).mockReset();
  vi.mocked(after)
    .mockReset()
    .mockImplementation((callback) => afterCallbacks.push(callback));
});

describe("the react-server build is what makes this testable", () => {
  test("React here implements cache for real, and only memoizes inside a request scope", () => {
    const slot = React.cache(() => ({}));

    expect(slot()).not.toBe(slot());
    enterRequestScope();
    expect(slot()).toBe(slot());
  });
});

describe("page surface — request-scoped boundary (ENG-2444)", () => {
  test("a check issued AFTER the choke-point helper returns is still attributed to the page surface", async () => {
    enterRequestScope();

    // Exactly the shape of a real page: await the choke point, then keep authorizing. Before this
    // change the surface closed with the helper and this check answered from the legacy evaluator
    // with no rollout target at all — correct, invisible, and unenforceable.
    await withAuthorizationSurface("page", async () => "workspace-auth");

    expect(getAuthorizationSurface()).toBe("page");
  });

  test("a layout and its page share ONE context, so the request records one observation", async () => {
    enterRequestScope();

    // Two choke points in one render — a layout's and its page's.
    await withAuthorizationSurface("page", async () => recordAuthorizationCheckIssued());
    await withAuthorizationSurface("page", async () => recordAuthorizationCheckIssued());
    // ...plus a check the page makes on its own, outside both.
    recordAuthorizationCheckIssued();

    expect(getIssuedAuthorizationCheckCount()).toBe(3);
    expect(afterCallbacks).toHaveLength(1);

    await afterCallbacks[0]();
    expect(recordAuthorizationChecksPerRequest).toHaveBeenCalledTimes(1);
    expect(recordAuthorizationChecksPerRequest).toHaveBeenCalledWith(3, "page");
  });

  test("two requests never share a context", async () => {
    enterRequestScope();
    await withAuthorizationSurface("page", async () => recordAuthorizationCheckIssued());
    expect(getIssuedAuthorizationCheckCount()).toBe(1);

    enterRequestScope();
    expect(getAuthorizationSurface()).toBe("unscoped");
    await withAuthorizationSurface("page", async () => undefined);
    expect(getIssuedAuthorizationCheckCount()).toBe(0);
  });

  test("an enclosing server-action surface keeps precedence over the page slot", async () => {
    enterRequestScope();

    await withAuthorizationSurface("server_action", async () => {
      await withAuthorizationSurface("page", async () => undefined);
      // The action opened first and owns the request: a page choke point inside it must not
      // re-attribute the request to `the page surface`.
      expect(getAuthorizationSurface()).toBe("server_action");
    });
  });

  test("outside a request scope it falls back to the async-scoped boundary", async () => {
    // Scripts and non-RSC callers have no scope to hang the slot on. The surface must still work
    // within the callback — that is the pre-ENG-2444 behaviour — and must not leak past it.
    await withAuthorizationSurface("page", async () => {
      expect(getAuthorizationSurface()).toBe("page");
    });

    expect(getAuthorizationSurface()).toBe("unscoped");
  });
});

import { describe, expect, test } from "vitest";
import { getBetterAuthRequestContext, runWithBetterAuthRequestContext } from "./better-auth-request-context";

describe("better-auth request context", () => {
  test("is undefined outside a run — a fault raised outside the HTTP handler stays reportable", () => {
    expect(getBetterAuthRequestContext()).toBeUndefined();
  });

  test("exposes the context inside the run", () => {
    const context = runWithBetterAuthRequestContext({ path: "/sign-in/email", method: "POST" }, () =>
      getBetterAuthRequestContext()
    );

    expect(context).toEqual({ path: "/sign-in/email", method: "POST" });
  });

  test("survives an await, which is the whole reason it can reach the router's error handler", async () => {
    // The Sentry capture happens deep inside `auth.handler`, several awaits after the store is opened.
    const seen = await runWithBetterAuthRequestContext(
      { path: "/oauth2/token", method: "POST" },
      async () => {
        await Promise.resolve();
        await new Promise((resolve) => setTimeout(resolve, 0));
        return getBetterAuthRequestContext();
      }
    );

    expect(seen).toEqual({ path: "/oauth2/token", method: "POST" });
  });

  test("keeps concurrent requests isolated", async () => {
    const [first, second] = await Promise.all([
      runWithBetterAuthRequestContext({ path: "/sign-in/email", method: "POST" }, async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return getBetterAuthRequestContext()?.path;
      }),
      runWithBetterAuthRequestContext({ path: "/get-session", method: "GET" }, async () => {
        await Promise.resolve();
        return getBetterAuthRequestContext()?.path;
      }),
    ]);

    expect(first).toBe("/sign-in/email");
    expect(second).toBe("/get-session");
  });

  test("returns to undefined after the run completes", async () => {
    await runWithBetterAuthRequestContext({ path: "/get-session", method: "GET" }, async () =>
      Promise.resolve()
    );

    expect(getBetterAuthRequestContext()).toBeUndefined();
  });
});

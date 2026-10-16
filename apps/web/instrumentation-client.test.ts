import { describe, expect, test, vi } from "vitest";
import { z } from "zod";

vi.mock("@sentry/nextjs", () => ({ captureRouterTransitionStart: vi.fn() }));
vi.mock("@/lib/sentry/init-client-sentry", () => ({ initClientSentryFromRuntimeConfig: vi.fn() }));

describe("instrumentation-client", () => {
  // Our production CSP has no 'unsafe-eval'; with the JIT on, Zod probes `new Function("")` and every
  // app page reports a violation (ENG-3969).
  test("turns Zod's JIT off in the browser", async () => {
    expect(z.config().jitless).not.toBe(true);

    await import("./instrumentation-client");

    expect(z.config().jitless).toBe(true);
  });
});

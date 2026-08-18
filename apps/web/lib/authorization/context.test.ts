import { after } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  getAuthorizationSurface,
  getIssuedAuthorizationCheckCount,
  recordAuthorizationCheckIssued,
  withAuthorizationSurface,
} from "./context";
import { recordAuthorizationChecksPerRequest } from "./metrics";

const afterCallbacks = vi.hoisted(() => [] as Array<() => Promise<void> | void>);

vi.mock("next/server", () => ({
  after: vi.fn((callback: () => Promise<void> | void) => afterCallbacks.push(callback)),
}));

vi.mock("./metrics", () => ({ recordAuthorizationChecksPerRequest: vi.fn() }));

beforeEach(() => {
  afterCallbacks.length = 0;
  vi.mocked(recordAuthorizationChecksPerRequest).mockReset();
  vi.mocked(after)
    .mockReset()
    .mockImplementation((callback) => afterCallbacks.push(callback));
});

describe("authorization request context", () => {
  test("preserves the outer surface across nested wrappers", async () => {
    await withAuthorizationSurface("api_v1", () =>
      withAuthorizationSurface("api_v3", async () => {
        expect(getAuthorizationSurface()).toBe("api_v1");
      })
    );

    expect(afterCallbacks).toHaveLength(1);
  });

  test("isolates concurrent request surfaces", async () => {
    const observed = await Promise.all([
      withAuthorizationSurface("api_v1", async () => {
        await Promise.resolve();
        return getAuthorizationSurface();
      }),
      withAuthorizationSurface("mcp", async () => {
        await Promise.resolve();
        return getAuthorizationSurface();
      }),
    ]);

    expect(observed).toEqual(["api_v1", "mcp"]);
    expect(afterCallbacks).toHaveLength(2);
  });

  test("is unscoped outside a request context", () => {
    expect(getAuthorizationSurface()).toBe("unscoped");
  });

  test("returns the callback result when after is unavailable", async () => {
    vi.mocked(after).mockImplementationOnce(() => {
      throw new Error("after is unavailable");
    });

    await expect(withAuthorizationSurface("server_action", async () => "completed")).resolves.toBe(
      "completed"
    );
    expect(afterCallbacks).toHaveLength(0);
  });

  test("counts each central operation within a surface", async () => {
    await withAuthorizationSurface("server_action", async () => {
      expect(getIssuedAuthorizationCheckCount()).toBe(0);
      recordAuthorizationCheckIssued();
      recordAuthorizationCheckIssued();
      expect(getIssuedAuthorizationCheckCount()).toBe(2);
    });
  });

  test("recording outside a surface is a no-op", () => {
    expect(getIssuedAuthorizationCheckCount()).toBeNull();
    expect(() => recordAuthorizationCheckIssued()).not.toThrow();
    expect(getIssuedAuthorizationCheckCount()).toBeNull();
  });

  test("keeps concurrent surfaces' counts independent", async () => {
    const counts = await Promise.all([
      withAuthorizationSurface("api_v1", async () => {
        recordAuthorizationCheckIssued();
        await Promise.resolve();
        recordAuthorizationCheckIssued();
        return getIssuedAuthorizationCheckCount();
      }),
      withAuthorizationSurface("mcp", async () => {
        recordAuthorizationCheckIssued();
        await Promise.resolve();
        return getIssuedAuthorizationCheckCount();
      }),
    ]);

    expect(counts).toEqual([2, 1]);
  });

  test("reports the request total after the response", async () => {
    await withAuthorizationSurface("api_v3", async () => {
      recordAuthorizationCheckIssued();
      recordAuthorizationCheckIssued();
    });

    expect(recordAuthorizationChecksPerRequest).not.toHaveBeenCalled();
    await afterCallbacks[0]();
    expect(recordAuthorizationChecksPerRequest).toHaveBeenCalledExactlyOnceWith(2, "api_v3");
  });

  test("records zero for a request with no authorization decision", async () => {
    await withAuthorizationSurface("server_action", async () => undefined);

    await afterCallbacks[0]();
    expect(recordAuthorizationChecksPerRequest).toHaveBeenCalledExactlyOnceWith(0, "server_action");
  });

  test("a telemetry failure does not affect the request", async () => {
    vi.mocked(recordAuthorizationChecksPerRequest).mockImplementationOnce(() => {
      throw new Error("meter provider exploded");
    });

    await withAuthorizationSurface("server_action", async () => undefined);
    expect(() => afterCallbacks[0]()).not.toThrow();
  });
});

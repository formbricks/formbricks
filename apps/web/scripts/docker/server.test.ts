import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);

test.each(["SIGTERM", "SIGINT"])(
  "drains workers when %s arrives during Next initialization",
  async (signal) => {
    let finish!: (handlers: unknown) => void;
    const handlersReady = new Promise((resolve) => {
      finish = resolve;
    });
    const callbacks = new Map<string, () => void>();
    const closeWorkers = vi.fn(async () => {});
    let releaseSafetyNet!: () => void;
    const safetyNetClosed = new Promise<void>((resolve) => {
      releaseSafetyNet = resolve;
    });
    const closeSafetyNet = vi.fn(() => safetyNetClosed);
    const closeApp = vi.fn(async () => {});
    const exit = vi.fn();
    const server = { listening: false, on: vi.fn(), listen: vi.fn(), close: vi.fn() };
    const lifecycle = { draining: false };
    runInNewContext(readFileSync(new URL("./server.js", import.meta.url), "utf8"), {
      __dirname: "/test",
      process: { env: {}, once: (name: string, callback: () => void) => callbacks.set(name, callback), exit },
      formbricksServerLifecycle: lifecycle,
      formbricksJobsRuntime: { close: closeWorkers },
      formbricksAuthzedOutboxSafetyNet: { close: closeSafetyNet },
      require: (name: string) => {
        if (name === "node:http") return { createServer: () => server };
        if (name === "node:fs") return { readFileSync: () => '{"config":{}}' };
        if (name === "next/dist/server/lib/start-server") return { getRequestHandlers: () => handlersReady };
        return require(name);
      },
    });
    await Promise.resolve();
    expect(callbacks.has(signal)).toBe(true);
    callbacks.get(signal)!();
    expect(lifecycle.draining).toBe(true);
    expect(exit).not.toHaveBeenCalled();
    finish({ server: { close: closeApp }, upgradeHandler: vi.fn() });
    // A drain the AuthZed safety net already started finishes before exit, rather than leaving its
    // claimed events leased for a minute.
    await vi.waitFor(() => expect(closeSafetyNet).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(exit).not.toHaveBeenCalled();
    releaseSafetyNet();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(server.listen).not.toHaveBeenCalled();
    expect(closeWorkers).toHaveBeenCalledOnce();
    expect(closeApp).toHaveBeenCalledOnce();
  }
);

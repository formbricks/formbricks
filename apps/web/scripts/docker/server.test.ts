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
    const closeApp = vi.fn(async () => {});
    const exit = vi.fn();
    const server = { listening: false, on: vi.fn(), listen: vi.fn(), close: vi.fn() };
    const lifecycle = { draining: false };
    runInNewContext(readFileSync(new URL("./server.js", import.meta.url), "utf8"), {
      __dirname: "/test",
      process: { env: {}, once: (name: string, callback: () => void) => callbacks.set(name, callback), exit },
      formbricksServerLifecycle: lifecycle,
      formbricksJobsRuntime: { close: closeWorkers },
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
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(server.listen).not.toHaveBeenCalled();
    expect(closeWorkers).toHaveBeenCalledOnce();
    expect(closeApp).toHaveBeenCalledOnce();
  }
);

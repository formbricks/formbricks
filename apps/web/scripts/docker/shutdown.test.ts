import { createRequire } from "node:module";
import { expect, test, vi } from "vitest";

const require = createRequire(import.meta.url);
const { shutdown } = require("./shutdown.js") as {
  shutdown: (hooks: Record<"closeHttp" | "closeWorkers" | "closeApp", () => Promise<void>>) => Promise<void>;
};

test("keeps producers alive until HTTP finishes and waits for active jobs before closing Next", async () => {
  let finishHttp!: () => void;
  let finishWorkers!: () => void;
  const closeHttp = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finishHttp = resolve;
      })
  );
  const closeWorkers = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finishWorkers = resolve;
      })
  );
  const closeApp = vi.fn(async () => {});
  const closing = shutdown({ closeHttp, closeWorkers, closeApp });
  expect(closeWorkers).not.toHaveBeenCalled();
  finishHttp();
  await Promise.resolve();
  expect(closeWorkers).toHaveBeenCalledOnce();
  expect(closeApp).not.toHaveBeenCalled();
  finishWorkers();
  await closing;
  expect(closeApp).toHaveBeenCalledOnce();
});

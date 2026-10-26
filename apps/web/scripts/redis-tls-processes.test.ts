import { spawn } from "node:child_process";
import { once } from "node:events";
import { describe, expect, test } from "vitest";
import { waitForRedisReady, waitForSuccessfulExit } from "./redis-tls-processes.mjs";

describe("Redis TLS harness child processes", () => {
  test("reports the final stderr and exit code after startup failure", async () => {
    const child = spawn(process.execPath, [
      "-e",
      'process.stderr.write("TLS startup failure"); process.exitCode = 17',
    ]);
    await expect(waitForRedisReady(child)).rejects.toThrow(/exit code: 17.*\nTLS startup failure/);
  });

  test("keeps draining stderr after readiness so a verbose child can finish", async () => {
    const child = spawn(process.execPath, [
      "-e",
      'process.stdout.write("Ready to accept connections\\n"); process.stderr.write("x".repeat(2_000_000), () => process.exit(0));',
    ]);
    const exited = waitForSuccessfulExit(child, "Verbose Redis");
    await waitForRedisReady(child);
    await expect(exited).resolves.toBeUndefined();
  });

  test("includes a terminating signal in child failures", async () => {
    const child = spawn(process.execPath, ["-e", 'process.kill(process.pid, "SIGTERM")']);
    await expect(waitForSuccessfulExit(child, "Authentication check")).rejects.toThrow(
      /Authentication check.*exit code: null, signal: SIGTERM/
    );
  });

  test("preserves a nonzero child exit code", async () => {
    const child = spawn(process.execPath, ["-e", "process.exit(9)"]);
    await expect(waitForSuccessfulExit(child, "BullMQ check")).rejects.toThrow(/exit code: 9, signal: none/);
  });

  test("bounds readiness waits for a child that never becomes ready", async () => {
    const child = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"]);
    try {
      await expect(waitForRedisReady(child, 20)).rejects.toThrow("Disposable Redis did not start");
    } finally {
      const closed = once(child, "close");
      child.kill("SIGTERM");
      await closed;
    }
  });
});

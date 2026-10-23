import assert from "node:assert/strict";
import { once } from "node:events";

export const waitForSuccessfulExit = async (child, label) => {
  const [code, signal] = await once(child, "close");
  assert.equal(code, 0, `${label} (exit code: ${code}, signal: ${signal ?? "none"})`);
};

export const waitForRedisReady = async (child, timeoutMs = 10_000) => {
  let stdout = "";
  let stderr = "";
  let launchError;
  let timer;
  const ready = new Promise((resolve) => {
    child.stdout.on("data", (data) => {
      stdout = (stdout + data.toString()).slice(-16_384);
      if (stdout.includes("Ready to accept connections")) resolve();
    });
  });
  // Keep draining after readiness, too: a full pipe can otherwise stall the disposable server.
  child.stderr.on("data", (data) => {
    stderr = (stderr + data.toString()).slice(-16_384);
  });
  child.once("error", (error) => {
    launchError = error;
  });
  const closed = new Promise((_resolve, reject) => {
    // close follows exit and the final stdout/stderr chunks, preserving startup diagnostics.
    child.once("close", (code, signal) => {
      reject(
        new Error(
          `Disposable Redis exited before ready (exit code: ${code}, signal: ${signal ?? "none"})\n${stderr || stdout}`,
          { cause: launchError }
        )
      );
    });
  });
  const timedOut = new Promise((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Disposable Redis did not start\n${stderr || stdout}`)),
      timeoutMs
    );
  });
  try {
    await Promise.race([ready, closed, timedOut]);
  } finally {
    clearTimeout(timer);
  }
};

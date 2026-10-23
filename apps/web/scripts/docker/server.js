/* eslint-disable @typescript-eslint/no-require-imports -- The standalone image loads this bootstrap as CommonJS. */
// Use the same router initialization as Next's generated standalone entry point, while owning the
// HTTP/worker shutdown sequence. Recheck this adapter whenever the pinned Next version changes.
const { createServer } = require("node:http");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { shutdown } = require("./shutdown.js");

const dir = __dirname;
const config = JSON.parse(readFileSync(join(dir, ".next/required-server-files.json"), "utf8")).config;
// eslint-disable-next-line turbo/no-undeclared-env-vars -- Next's generated standalone entry point sets this at runtime too.
process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(config);
const { getRequestHandlers } = require("next/dist/server/lib/start-server");
// eslint-disable-next-line turbo/no-undeclared-env-vars -- Runtime listener setting, not a build input.
const port = Number.parseInt(process.env.PORT || "3000", 10);
// eslint-disable-next-line turbo/no-undeclared-env-vars -- Runtime listener setting, not a build input.
const hostname = process.env.HOSTNAME || "0.0.0.0";
const state = (globalThis.formbricksServerLifecycle ??= { draining: false });
let handlers;
let stopping;
const server = createServer((request, response) => {
  if (state.draining) {
    response.writeHead(503, { Connection: "close" });
    response.end();
    return;
  }
  handlers.requestHandler(request, response).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});

// Signals can arrive while instrumentation is starting workers, before Next has returned handlers.
const stop = (exitCode = 0) => {
  state.draining = true;
  stopping ??= (async () => {
    await initialization.catch(() => undefined);
    await shutdown({
      closeHttp: () =>
        server.listening
          ? new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
          : Promise.resolve(),
      closeWorkers: async () => {
        await globalThis.formbricksJobsRuntimeInitializing?.catch(() => undefined);
        await globalThis.formbricksJobsRuntime?.close();
        await globalThis.formbricksOnlinePauseDelivery?.close();
      },
      closeApp: () => handlers?.server.close(),
    });
  })().then(
    () => process.exit(exitCode),
    () => process.exit(1)
  );
};
process.once("SIGTERM", () => stop());
process.once("SIGINT", () => stop());
const initialization = Promise.resolve().then(async () => {
  handlers = await getRequestHandlers({
    dir,
    port,
    isDev: false,
    server,
    hostname,
    onDevServerCleanup: undefined,
  });
  if (state.draining) return;
  server.on("upgrade", handlers.upgradeHandler);
  server.listen(port, hostname);
});
initialization.catch(() => stop(1));

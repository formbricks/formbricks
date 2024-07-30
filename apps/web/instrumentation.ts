export const register = async () => {
  // await require("next-logger/presets/next-only");
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OPENTELEMETRY_LISTENER_URL) {
    const { startInstrumentationForNode } = await import("./instrumentation.node");

    startInstrumentationForNode(process.env.OPENTELEMETRY_LISTENER_URL);
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await require("pino");
    await require("next-logger");
  }
};

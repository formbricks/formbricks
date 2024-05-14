export const register = async () => {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.OPENTELEMETRY_LISTENER_URL) {
    const { startInstrumentationForNode } = await import("./instrumentation.node");

    startInstrumentationForNode(process.env.OPENTELEMETRY_LISTENER_URL);
  }
};

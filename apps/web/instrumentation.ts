export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("Configuring OpenTelemetry");
    const { startInstrumentationForNode } = await import("./instrumentation.node");

    startInstrumentationForNode();
  }
}

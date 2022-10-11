import getConfig from "next/config";
import { hashString } from "./utils";

const { serverRuntimeConfig } = getConfig();

/* We use this telemetry service to better understand how snoopForms is being used
   and how we can improve it. All data including the IP address is collected anonymously
   and we cannot trace anything back to you or your customers. If you still want to
   disable telemetry, set the environment variable TELEMETRY_DISABLED=1 */

export const sendTelemetry = async (eventName: string) => {
  if (
    !serverRuntimeConfig.telemetryDisabled &&
    process.env.NODE_ENV === "production" &&
    serverRuntimeConfig.nextauthUrl !== "http://localhost:3000"
  ) {
    try {
      await fetch("https://posthog.snoopforms.com/capture/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: "phc_BTq4eagaCzPyUSURXVYwlScTQRvcmBDXjYh7OG6kiqw",
          event: eventName,
          properties: {
            distinct_id: hashString(serverRuntimeConfig.nextauthUrl),
          },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.log("error sending telemetry:", error);
    }
  }
};

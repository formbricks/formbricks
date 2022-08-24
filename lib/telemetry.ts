import getConfig from "next/config";
import { PostHog } from "posthog-node";
import crypto from "crypto";

const { serverRuntimeConfig } = getConfig();

/* We use this telemetry service to better understand how snoopForms is being used
   and how we can improve it. All data including the IP address is collected anonymously
   and we cannot trace anything back to you or your customers. If you still want to
   disable telemetry, set the environment variable TELEMETRY_DISABLED=1 */

export const sendTelemetry = (event: string) => {
  if (
    serverRuntimeConfig.nextauthUrl !== "http://localhost:3000" &&
    !serverRuntimeConfig.telemetryDisabled
  ) {
    const client = new PostHog(
      "phc_BTq4eagaCzPyUSURXVYwlScTQRvcmBDXjYh7OG6kiqw",
      { host: "https://posthog.snoopforms.com" }
    );
    client.capture({
      distinctId: crypto
        .createHash("sha256")
        .update(serverRuntimeConfig.nextauthUrl)
        .digest("hex"),
      event,
    });
  }
};

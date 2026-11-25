import type { PostHogConfig } from "posthog-js";
import { maskWebhookNetworkRequests } from "./mask-webhook-network-requests";

// Respondent answers, emails and contact data are rendered across the app, so nothing the user sees
// may leave the browser: recordings mask every text node and input, autocapture drops element
// text and attribute values (posthog-js masks inputs by default, but not rendered text).
export const getPostHogConfig = (isDevelopmentBuild: boolean): Partial<PostHogConfig> => ({
  api_host: "/ingest",
  ui_host: "https://eu.i.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  debug: isDevelopmentBuild,
  mask_all_text: true,
  mask_all_element_attributes: true,
  session_recording: {
    blockSelector: "iframe[src*='cdn-plain']",
    maskAllInputs: true,
    maskTextSelector: "*",
    maskCapturedNetworkRequestFn: maskWebhookNetworkRequests,
  },
});

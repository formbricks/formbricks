import posthog from "posthog-js";

const EXCLUDED_PATTERN =
  /^\/(s|c|p)\/|^\/auth\/|^\/invite|^\/verify-email-change|^\/email-change-without-verification-success/;

const isExcludedPage = () => typeof window !== "undefined" && EXCLUDED_PATTERN.test(window.location.pathname);

if (process.env.NEXT_PUBLIC_POSTHOG_KEY && !isExcludedPage()) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: "/ingest",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-01-30",
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
    before_send: (event) => {
      if (isExcludedPage()) return null;
      return event;
    },
  });
}

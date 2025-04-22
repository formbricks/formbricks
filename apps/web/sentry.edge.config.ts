// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/
import { SENTRY_DSN } from "@/lib/constants";
import * as Sentry from "@sentry/nextjs";
import { logger } from "@formbricks/logger";

if (SENTRY_DSN) {
  logger.info("Sentry DSN found, enabling Sentry on the edge");

  Sentry.init({
    dsn: SENTRY_DSN,

    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,
  });
} else {
  logger.warn("Sentry DSN not found, Sentry will be disabled on the edge");
}

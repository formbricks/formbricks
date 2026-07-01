"use client";

import { useEffect } from "react";
import {
  ATTRIBUTION_COOKIE_MAX_AGE,
  ATTRIBUTION_COOKIE_NAME,
  MAX_ATTRIBUTION_COOKIE_VALUE_LENGTH,
  pickAttributionParams,
} from "@/modules/auth/lib/attribution";

/**
 * Writes the first-touch marketing attribution cookie on the auth pages.
 *
 * On mount it reads the whitelisted attribution params from the current URL and,
 * only if the cookie is not already set, stores them so the value survives
 * navigation between /auth/login and /auth/signup as well as the OAuth redirect.
 * Renders nothing.
 */
export const AttributionTracker = () => {
  useEffect(() => {
    // First-touch: never overwrite an existing attribution cookie.
    const alreadySet = document.cookie
      .split(";")
      .some((cookie) => cookie.trim().startsWith(`${ATTRIBUTION_COOKIE_NAME}=`));
    if (alreadySet) return;

    const params = new URLSearchParams(window.location.search);
    const attribution = pickAttributionParams(params);
    if (Object.keys(attribution).length === 0) return;

    const value = encodeURIComponent(JSON.stringify(attribution));
    // Oversized cookies are silently dropped by the browser; skip rather than write
    // a cookie that will never persist (e.g. long multibyte values that inflate under
    // percent-encoding). `value.length` is the encoded (ASCII) length ≈ byte size.
    if (value.length > MAX_ATTRIBUTION_COOKIE_VALUE_LENGTH) return;

    // Add Secure on HTTPS so the cookie is not written/sent over plaintext in production.
    // Omit it on http (localhost) where Secure cookies are rejected.
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ATTRIBUTION_COOKIE_NAME}=${value}; path=/; max-age=${ATTRIBUTION_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
  }, []);

  return null;
};

"use client";

import { useEffect } from "react";
import { setBrowserSentryUser } from "@/lib/sentry/browser-user";

interface SentryUserProps {
  userId: string;
}

/** Rendered only inside the authenticated app layout; see `setBrowserSentryUser`. */
export const SentryUser = ({ userId }: Readonly<SentryUserProps>) => {
  useEffect(() => setBrowserSentryUser(userId), [userId]);

  return null;
};

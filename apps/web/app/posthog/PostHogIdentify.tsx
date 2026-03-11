"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";

interface PostHogIdentifyProps {
  userId: string;
  email: string;
  name: string;
}

export const PostHogIdentify = ({ userId, email, name }: PostHogIdentifyProps) => {
  const lastIdentifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    if (lastIdentifiedUserId.current && lastIdentifiedUserId.current !== userId) {
      posthog.reset();
    }

    posthog.identify(userId, { email, name });
    lastIdentifiedUserId.current = userId;
  }, [userId, email, name]);

  return null;
};

"use client";

import posthog from "posthog-js";
import { useEffect, useRef } from "react";
import { IS_DEVELOPMENT_BUILD } from "@/lib/env-client";
import { getPostHogConfig } from "./posthog-config";

interface PostHogIdentifyProps {
  readonly posthogKey: string;
  readonly userId: string;
  readonly email: string;
  readonly name: string | null;
}

export const PostHogIdentify = ({ posthogKey, userId, email, name }: PostHogIdentifyProps) => {
  const lastIdentifiedUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!posthog.__loaded) {
      posthog.init(posthogKey, getPostHogConfig(IS_DEVELOPMENT_BUILD));
    }

    if (lastIdentifiedUserId.current && lastIdentifiedUserId.current !== userId) {
      posthog.reset();
    }

    posthog.identify(userId, { email, name });
    lastIdentifiedUserId.current = userId;
  }, [posthogKey, userId, email, name]);

  return null;
};

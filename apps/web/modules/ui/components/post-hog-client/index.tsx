"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import React, { type JSX, useEffect } from "react";

interface PostHogPageviewProps {
  posthogEnabled: boolean;
  postHogApiHost?: string;
  postHogApiKey?: string;
}

export const PostHogPageview = ({
  posthogEnabled,
  postHogApiHost,
  postHogApiKey,
}: PostHogPageviewProps): JSX.Element => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!posthogEnabled) return;
    try {
      if (!postHogApiHost) {
        throw new Error("Posthog API host is required");
      }
      if (!postHogApiKey) {
        throw new Error("Posthog key is required");
      }
      posthog.init(postHogApiKey, { api_host: postHogApiHost });
    } catch (error) {
      console.error("Failed to initialize PostHog:", error);
    }
  }, []);

  useEffect(() => {
    if (!posthogEnabled) return;
    let url = window.origin + pathname;
    if (searchParams?.toString()) {
      url += `?${searchParams.toString()}`;
    }
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams, posthogEnabled]);

  return <></>;
};

interface PHPProviderProps {
  children: React.ReactNode;
  posthogEnabled: boolean;
}

export const PHProvider = ({ children, posthogEnabled }: PHPProviderProps) => {
  return posthogEnabled ? <PostHogProvider client={posthog}>{children}</PostHogProvider> : children;
};

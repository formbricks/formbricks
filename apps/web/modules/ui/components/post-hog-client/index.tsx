"use client";

import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { type JSX, useEffect } from "react";
import { env } from "@formbricks/lib/env";

const posthogEnabled = env.NEXT_PUBLIC_POSTHOG_API_KEY && env.NEXT_PUBLIC_POSTHOG_API_HOST;

if (typeof window !== "undefined") {
  if (posthogEnabled) {
    posthog.init(env.NEXT_PUBLIC_POSTHOG_API_KEY!, {
      api_host: env.NEXT_PUBLIC_POSTHOG_API_HOST,
    });
  }
}

export const PostHogPageview = (): JSX.Element => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (posthogEnabled && pathname) {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }
      posthog.capture("$pageview", {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

  return <></>;
};

export const PHProvider = ({ children }: { children: React.ReactNode }) => {
  return posthogEnabled ? <PostHogProvider client={posthog}>{children}</PostHogProvider> : children;
};

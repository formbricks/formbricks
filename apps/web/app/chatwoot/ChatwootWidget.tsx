"use client";

import { useCallback, useEffect, useRef } from "react";
import { TUser } from "@formbricks/types/user";

interface ChatwootWidgetProps {
  chatwootBaseUrl: string;
  isChatwootConfigured: boolean;
  chatwootWebsiteToken?: string;
  user?: TUser | null;
}

export const ChatwootWidget = ({
  user,
  isChatwootConfigured,
  chatwootWebsiteToken,
  chatwootBaseUrl,
}: ChatwootWidgetProps) => {
  const userSetRef = useRef(false);

  const initializeChatwoot = useCallback(() => {
    if (!isChatwootConfigured) {
      return;
    }

    const script = document.createElement("script") as HTMLScriptElement;
    const firstScript = document.getElementsByTagName("script")[0];

    script.src = `${chatwootBaseUrl}/packs/js/sdk.js`;
    script.id = "chatwoot-script";
    script.async = true;

    script.onload = () => {
      (window as any).chatwootSDK.run({
        websiteToken: chatwootWebsiteToken!,
        baseUrl: chatwootBaseUrl,
      });
    };

    firstScript.parentNode?.insertBefore(script, firstScript);
  }, [isChatwootConfigured, chatwootBaseUrl, chatwootWebsiteToken]);

  // Set user information when Chatwoot is ready
  useEffect(() => {
    if (!isChatwootConfigured) {
      return;
    }

    const handleChatwootReady = () => {
      if (user && (window as any).$chatwoot && !userSetRef.current) {
        (window as any).$chatwoot.setUser(user.id, {
          email: user.email,
          name: user.name,
        });

        userSetRef.current = true;
      }
    };

    window.addEventListener("chatwoot:ready", handleChatwootReady);

    return () => {
      window.removeEventListener("chatwoot:ready", handleChatwootReady);
    };
  }, [user, isChatwootConfigured]);

  useEffect(() => {
    if (!isChatwootConfigured) {
      return;
    }

    try {
      // Check if script is already loaded
      if (document.getElementById("chatwoot-script")) {
        return;
      }

      initializeChatwoot();

      return () => {
        // Cleanup Chatwoot when component unmounts
        if (typeof window !== "undefined" && (window as any).$chatwoot) {
          (window as any).$chatwoot.reset();
          userSetRef.current = false;
        }
      };
    } catch (error) {
      console.error("Failed to initialize Chatwoot:", error);
    }
  }, [initializeChatwoot, isChatwootConfigured]);

  return null;
};

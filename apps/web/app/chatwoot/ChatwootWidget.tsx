"use client";

import { useCallback, useEffect, useRef } from "react";

interface ChatwootWidgetProps {
  chatwootBaseUrl: string;
  isChatwootConfigured: boolean;
  chatwootWebsiteToken?: string;
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
}

export const ChatwootWidget = ({
  userEmail,
  userName,
  userId,
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
      if (userId && (window as any).$chatwoot && !userSetRef.current) {
        (window as any).$chatwoot.setUser(userId, {
          email: userEmail ?? "Unknown",
          name: userName ?? "Unknown",
        });

        userSetRef.current = true;
      }
    };

    window.addEventListener("chatwoot:ready", handleChatwootReady);

    return () => {
      window.removeEventListener("chatwoot:ready", handleChatwootReady);
    };
  }, [userId, isChatwootConfigured]);

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

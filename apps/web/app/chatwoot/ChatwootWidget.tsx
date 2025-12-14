"use client";

import { useCallback, useEffect, useRef } from "react";
import { TUser } from "@formbricks/types/user";

interface ChatwootWidgetProps {
  isChatwootConfigured: boolean;
  chatwootWebsiteToken?: string;
  chatwootBaseUrl?: string;
  user?: TUser | null;
}

export const ChatwootWidget = ({
  user,
  isChatwootConfigured,
  chatwootWebsiteToken,
  chatwootBaseUrl,
}: ChatwootWidgetProps) => {
  const userSetRef = useRef(false);

  // Early return if Chatwoot is not configured
  if (!isChatwootConfigured) {
    return null;
  }

  const initializeChatwoot = useCallback(() => {
    const BASE_URL = chatwootBaseUrl || "https://app.chatwoot.com";

    (function (d, t) {
      var g = d.createElement(t) as HTMLScriptElement,
        s = d.getElementsByTagName(t)[0];
      g.src = BASE_URL + "/packs/js/sdk.js";
      g.id = "chatwoot-script";
      g.async = true;
      s.parentNode?.insertBefore(g, s);
      g.onload = function () {
        (window as any).chatwootSDK.run({
          websiteToken: chatwootWebsiteToken!,
          baseUrl: BASE_URL,
        });
      };
    })(document, "script");
  }, [chatwootWebsiteToken, chatwootBaseUrl]);

  // Set user information when Chatwoot is ready
  useEffect(() => {
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
  }, [user]);

  useEffect(() => {
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
  }, [initializeChatwoot]);

  return null;
};

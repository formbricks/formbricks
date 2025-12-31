"use client";

import { useCallback, useEffect, useRef } from "react";

interface ChatwootWidgetProps {
  chatwootBaseUrl: string;
  chatwootWebsiteToken?: string;
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
}

const CHATWOOT_SCRIPT_ID = "chatwoot-script";

export const ChatwootWidget = ({
  userEmail,
  userName,
  userId,
  chatwootWebsiteToken,
  chatwootBaseUrl,
}: ChatwootWidgetProps) => {
  const userSetRef = useRef(false);

  const setUserInfo = useCallback(() => {
    const $chatwoot = (
      globalThis as unknown as {
        $chatwoot: {
          setUser: (userId: string, userInfo: { email?: string | null; name?: string | null }) => void;
        };
      }
    ).$chatwoot;
    if (userId && $chatwoot && !userSetRef.current) {
      $chatwoot.setUser(userId, {
        email: userEmail,
        name: userName,
      });
      userSetRef.current = true;
    }
  }, [userId, userEmail, userName]);

  useEffect(() => {
    if (!chatwootWebsiteToken) return;

    const existingScript = document.getElementById(CHATWOOT_SCRIPT_ID);
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = `${chatwootBaseUrl}/packs/js/sdk.js`;
    script.id = CHATWOOT_SCRIPT_ID;
    script.async = true;

    script.onload = () => {
      (
        globalThis as unknown as {
          chatwootSDK: { run: (options: { websiteToken: string; baseUrl: string }) => void };
        }
      ).chatwootSDK?.run({
        websiteToken: chatwootWebsiteToken,
        baseUrl: chatwootBaseUrl,
      });
    };

    document.head.appendChild(script);

    const handleChatwootReady = () => setUserInfo();
    globalThis.addEventListener("chatwoot:ready", handleChatwootReady);

    // Check if Chatwoot is already ready
    if (
      (
        globalThis as unknown as {
          $chatwoot: {
            setUser: (userId: string, userInfo: { email?: string | null; name?: string | null }) => void;
          };
        }
      ).$chatwoot
    ) {
      setUserInfo();
    }

    return () => {
      globalThis.removeEventListener("chatwoot:ready", handleChatwootReady);

      const $chatwoot = (globalThis as unknown as { $chatwoot: { reset: () => void } }).$chatwoot;
      if ($chatwoot) {
        $chatwoot.reset();
      }

      const scriptElement = document.getElementById(CHATWOOT_SCRIPT_ID);
      scriptElement?.remove();

      userSetRef.current = false;
    };
  }, [chatwootBaseUrl, chatwootWebsiteToken, userId, userEmail, userName, setUserInfo]);

  return null;
};

"use client";

import { useEffect, useRef } from "react";

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

  const setUserInfo = () => {
    const $chatwoot = (window as any).$chatwoot;
    if (userId && $chatwoot && !userSetRef.current) {
      $chatwoot.setUser(userId, {
        email: userEmail,
        name: userName,
      });
      userSetRef.current = true;
    }
  };

  useEffect(() => {
    if (!chatwootWebsiteToken) return;

    const existingScript = document.getElementById(CHATWOOT_SCRIPT_ID);
    if (existingScript) return;

    const script = document.createElement("script");
    script.src = `${chatwootBaseUrl}/packs/js/sdk.js`;
    script.id = CHATWOOT_SCRIPT_ID;
    script.async = true;

    script.onload = () => {
      (window as any).chatwootSDK?.run({
        websiteToken: chatwootWebsiteToken,
        baseUrl: chatwootBaseUrl,
      });
    };

    document.head.appendChild(script);

    const handleChatwootReady = () => setUserInfo();
    window.addEventListener("chatwoot:ready", handleChatwootReady);

    // Check if Chatwoot is already ready
    if ((window as any).$chatwoot) {
      setUserInfo();
    }

    return () => {
      window.removeEventListener("chatwoot:ready", handleChatwootReady);

      const $chatwoot = (window as any).$chatwoot;
      if ($chatwoot) {
        $chatwoot.reset();
      }

      const scriptElement = document.getElementById(CHATWOOT_SCRIPT_ID);
      scriptElement?.remove();

      userSetRef.current = false;
    };
  }, [chatwootBaseUrl, chatwootWebsiteToken, userId, userEmail, userName]);

  return null;
};

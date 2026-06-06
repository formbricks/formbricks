"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { getIsActiveCustomerAction } from "./actions";
import { isOnboardingPathname } from "./is-onboarding-pathname";

interface ChatwootWidgetProps {
  chatwootBaseUrl: string;
  chatwootWebsiteToken?: string;
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
}

const CHATWOOT_SCRIPT_ID = "chatwoot-script";
const CHATWOOT_ONBOARDING_HIDE_STYLE_ID = "chatwoot-onboarding-hide";
const CHATWOOT_HIDE_SELECTORS =
  "#chatwoot_live_chat_widget, .woot-widget-holder, .woot--bubble-holder, #cw-widget-holder";

interface ChatwootInstance {
  setUser: (
    userId: string,
    userInfo: {
      email?: string | null;
      name?: string | null;
    }
  ) => void;
  setCustomAttributes: (attributes: Record<string, unknown>) => void;
  reset: () => void;
}

export const ChatwootWidget = ({
  userEmail,
  userName,
  userId,
  chatwootWebsiteToken,
  chatwootBaseUrl,
}: ChatwootWidgetProps) => {
  const pathname = usePathname();
  const isOnboarding = isOnboardingPathname(pathname);
  const userSetRef = useRef(false);
  const customerStatusSetRef = useRef(false);

  const getChatwoot = useCallback((): ChatwootInstance | null => {
    return (globalThis as unknown as { $chatwoot: ChatwootInstance }).$chatwoot ?? null;
  }, []);

  const setUserInfo = useCallback(() => {
    const $chatwoot = getChatwoot();
    if (userId && $chatwoot && !userSetRef.current) {
      $chatwoot.setUser(userId, {
        email: userEmail,
        name: userName,
      });
      userSetRef.current = true;
    }
  }, [userId, userEmail, userName, getChatwoot]);

  const setCustomerStatus = useCallback(async () => {
    if (customerStatusSetRef.current) return;
    const $chatwoot = getChatwoot();
    if (!$chatwoot) return;

    const response = await getIsActiveCustomerAction();
    if (response?.data !== undefined) {
      $chatwoot.setCustomAttributes({ isActiveCustomer: response.data });
    }
    customerStatusSetRef.current = true;
  }, [getChatwoot]);

  useEffect(() => {
    const hideStyle = document.getElementById(CHATWOOT_ONBOARDING_HIDE_STYLE_ID);

    if (isOnboarding) {
      if (!hideStyle) {
        const style = document.createElement("style");
        style.id = CHATWOOT_ONBOARDING_HIDE_STYLE_ID;
        style.textContent = `${CHATWOOT_HIDE_SELECTORS} { display: none !important; visibility: hidden !important; }`;
        document.head.appendChild(style);
      }
      return;
    }

    hideStyle?.remove();
  }, [isOnboarding]);

  useEffect(() => {
    if (!chatwootWebsiteToken || isOnboarding) return;

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

    const handleChatwootOpen = () => setCustomerStatus();
    globalThis.addEventListener("chatwoot:open", handleChatwootOpen);

    // Check if Chatwoot is already ready
    if (getChatwoot()) {
      setUserInfo();
    }

    return () => {
      globalThis.removeEventListener("chatwoot:ready", handleChatwootReady);
      globalThis.removeEventListener("chatwoot:open", handleChatwootOpen);

      const $chatwoot = getChatwoot();
      if ($chatwoot) {
        $chatwoot.reset();
      }

      const scriptElement = document.getElementById(CHATWOOT_SCRIPT_ID);
      scriptElement?.remove();

      userSetRef.current = false;
      customerStatusSetRef.current = false;
    };
  }, [
    chatwootBaseUrl,
    chatwootWebsiteToken,
    isOnboarding,
    userId,
    userEmail,
    userName,
    setUserInfo,
    setCustomerStatus,
    getChatwoot,
  ]);

  return null;
};

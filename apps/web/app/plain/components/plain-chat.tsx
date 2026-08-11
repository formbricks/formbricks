"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormbricksLogo } from "@/modules/ui/components/formbricks-logo";
import { isOnboardingPathname } from "../lib/utils";

interface PlainChatProps {
  appId: string;
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
  /** HMAC-SHA256 of the user's email, computed server-side. Verifies the customer's identity. */
  emailHash?: string | null;
  /**
   * Plain label type applied to every thread this user opens. The layout resolves
   * this to the paying-customer label id (or null) server-side, so it is attached
   * at init time — before the first thread is created.
   */
  activeCustomerLabelTypeId?: string | null;
}

const PLAIN_SCRIPT_ID = "plain-chat-script";
const PLAIN_SCRIPT_SRC = "https://chat.cdn-plain.com/index.js";

// Formbricks brand teal — matches the FormbricksLogo mark and brands the chat panel.
const BRAND_COLOR = "#00C4B8";

interface PlainCustomerDetails {
  email: string;
  emailHash?: string;
  fullName?: string;
  shortName?: string;
  externalId?: string;
}

interface PlainInitOptions {
  appId: string;
  hideLauncher?: boolean;
  theme?: "auto" | "light" | "dark";
  style?: {
    brandColor?: string;
    brandBackgroundColor?: string;
    launcherBackgroundColor?: string;
    launcherIconColor?: string;
  };
  customerDetails?: PlainCustomerDetails;
  threadDetails?: { labelTypeIds?: string[] };
}

interface PlainInstance {
  init: (options: PlainInitOptions) => void;
  update: (options: Partial<PlainInitOptions>) => void;
  setCustomerDetails: (details: PlainCustomerDetails) => void;
  open: () => void;
  close: () => void;
  isInitialized: () => boolean;
}

const getPlain = (): PlainInstance | null =>
  (globalThis as unknown as { Plain?: PlainInstance }).Plain ?? null;

const buildCustomerDetails = (
  userEmail?: string | null,
  emailHash?: string | null,
  userName?: string | null,
  userId?: string | null
): PlainCustomerDetails | undefined => {
  if (!userEmail) return undefined;
  return {
    email: userEmail,
    emailHash: emailHash ?? undefined,
    fullName: userName ?? undefined,
    shortName: userName?.split(" ")[0] ?? undefined,
    externalId: userId ?? undefined,
  };
};

export const PlainChat = ({
  appId,
  userEmail,
  userName,
  userId,
  emailHash,
  activeCustomerLabelTypeId,
}: Readonly<PlainChatProps>) => {
  const { t } = useTranslation();
  const pathname = usePathname();
  const isOnboarding = isOnboardingPathname(pathname);

  // The widget script loads asynchronously; only render our launcher once Plain
  // is initialized so a click can actually open the panel.
  const [isReady, setIsReady] = useState(false);

  // Snapshot the latest init inputs so the async script onload closure reads
  // current values without re-registering the loader on every prop change.
  // The default launcher stays hidden — we render our own branded launcher below.
  const initOptionsRef = useRef<PlainInitOptions>({ appId });
  useEffect(() => {
    initOptionsRef.current = {
      appId,
      theme: "auto",
      hideLauncher: true,
      style: { brandColor: BRAND_COLOR },
      customerDetails: buildCustomerDetails(userEmail, emailHash, userName, userId),
      threadDetails: activeCustomerLabelTypeId ? { labelTypeIds: [activeCustomerLabelTypeId] } : undefined,
    };
  });

  // Load the widget once and initialize it. Identity and label changes are
  // handled by the effects below via Plain's in-place update APIs, so the
  // script is never re-injected and no listeners are left dangling.
  useEffect(() => {
    const markReady = () => {
      if (getPlain()?.isInitialized()) setIsReady(true);
    };

    if (!document.getElementById(PLAIN_SCRIPT_ID)) {
      const script = document.createElement("script");
      script.src = PLAIN_SCRIPT_SRC;
      script.id = PLAIN_SCRIPT_ID;
      script.async = true;
      script.onload = () => {
        const plain = getPlain();
        if (plain && !plain.isInitialized()) {
          plain.init(initOptionsRef.current);
        }
        markReady();
      };
      document.head.appendChild(script);
    } else {
      // Script already present (e.g. remount): the widget is or will be ready.
      markReady();
    }

    return () => {
      // Close the widget on unmount (e.g. logout). The identity effect below
      // overwrites customer details on account switches so no prior-user data
      // persists into the next session.
      getPlain()?.close();
    };
  }, []);

  // Push identity changes (login, account switch) into the already-initialized
  // widget instead of re-initializing, preventing stale customer data.
  useEffect(() => {
    const plain = getPlain();
    if (!plain?.isInitialized()) return;
    const customerDetails = buildCustomerDetails(userEmail, emailHash, userName, userId);
    if (customerDetails) {
      plain.setCustomerDetails(customerDetails);
    }
  }, [userEmail, emailHash, userName, userId]);

  // Keep the active-customer label in sync once resolved.
  useEffect(() => {
    const plain = getPlain();
    if (!plain?.isInitialized()) return;
    plain.update({
      threadDetails: activeCustomerLabelTypeId ? { labelTypeIds: [activeCustomerLabelTypeId] } : undefined,
    });
  }, [activeCustomerLabelTypeId]);

  const openChat = useCallback(() => {
    getPlain()?.open();
  }, []);

  // Hide our launcher during onboarding to keep those flows distraction-free.
  if (!isReady || isOnboarding) return null;

  return (
    <button
      type="button"
      onClick={openChat}
      aria-label={t("common.open_support_chat")}
      className="fixed right-6 bottom-6 z-50 flex h-14 w-14 items-center justify-center rounded-full border border-slate-200 bg-white shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2">
      <FormbricksLogo className="h-8 w-8" />
    </button>
  );
};

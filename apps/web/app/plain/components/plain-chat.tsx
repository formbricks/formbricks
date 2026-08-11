"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
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

// Formbricks brand teal — brands the chat panel accents.
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
  const pathname = usePathname();
  const isOnboarding = isOnboardingPathname(pathname);

  // Snapshot the latest init inputs so the async script onload closure reads
  // current values without re-registering the loader on every prop change.
  const initOptionsRef = useRef<PlainInitOptions>({ appId });
  useEffect(() => {
    initOptionsRef.current = {
      appId,
      theme: "auto",
      hideLauncher: isOnboarding,
      style: { brandColor: BRAND_COLOR },
      customerDetails: buildCustomerDetails(userEmail, emailHash, userName, userId),
      threadDetails: activeCustomerLabelTypeId ? { labelTypeIds: [activeCustomerLabelTypeId] } : undefined,
    };
  });

  // Load the widget once and initialize it. Identity, onboarding, and label
  // changes are handled by the effects below via Plain's in-place update APIs,
  // so the script is never re-injected and no listeners are left dangling.
  useEffect(() => {
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
      };
      document.head.appendChild(script);
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

  // Toggle the launcher as the user moves in and out of onboarding.
  useEffect(() => {
    const plain = getPlain();
    if (!plain?.isInitialized()) return;
    plain.update({ hideLauncher: isOnboarding });
  }, [isOnboarding]);

  return null;
};

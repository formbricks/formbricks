"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { getIsActiveCustomerAction } from "../lib/actions";
import { isOnboardingPathname } from "../lib/utils";

interface PlainChatProps {
  appId: string;
  userEmail?: string | null;
  userName?: string | null;
  userId?: string | null;
  /** HMAC-SHA256 of the user's email, computed server-side. Verifies the customer's identity. */
  emailHash?: string | null;
  /** Plain label type applied to threads opened by paying customers. Optional. */
  activeCustomerLabelTypeId?: string | null;
}

const PLAIN_SCRIPT_ID = "plain-chat-script";
const PLAIN_SCRIPT_SRC = "https://chat.cdn-plain.com/index.js";

interface PlainCustomerDetails {
  email?: string;
  emailHash?: string;
  fullName?: string;
  shortName?: string;
  externalId?: string;
}

interface PlainInitOptions {
  appId: string;
  hideLauncher?: boolean;
  theme?: "auto" | "light" | "dark";
  customerDetails?: PlainCustomerDetails;
  threadDetails?: { labelTypeIds?: string[] };
}

interface PlainInstance {
  init: (options: PlainInitOptions) => void;
  update: (options: Partial<PlainInitOptions>) => void;
  open: () => void;
  close: () => void;
  onOpen: (callback: () => void) => void;
  isInitialized: () => boolean;
}

const getPlain = (): PlainInstance | null =>
  (globalThis as unknown as { Plain?: PlainInstance }).Plain ?? null;

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
  // Snapshot the onboarding state for the initial hideLauncher; later changes are
  // handled by the launcher-toggle effect so the widget is only initialized once.
  const isOnboardingRef = useRef(isOnboarding);
  isOnboardingRef.current = isOnboarding;

  const initializedRef = useRef(false);
  const customerStatusSetRef = useRef(false);

  const buildCustomerDetails = useCallback((): PlainCustomerDetails | undefined => {
    if (!userEmail) return undefined;
    return {
      email: userEmail,
      emailHash: emailHash ?? undefined,
      fullName: userName ?? undefined,
      shortName: userName?.split(" ")[0] ?? undefined,
      externalId: userId ?? undefined,
    };
  }, [userEmail, emailHash, userName, userId]);

  const applyCustomerStatus = useCallback(async () => {
    if (customerStatusSetRef.current || !activeCustomerLabelTypeId) return;
    const plain = getPlain();
    if (!plain) return;

    const response = await getIsActiveCustomerAction();
    if (response?.data) {
      plain.update({ threadDetails: { labelTypeIds: [activeCustomerLabelTypeId] } });
    }
    customerStatusSetRef.current = true;
  }, [activeCustomerLabelTypeId]);

  useEffect(() => {
    if (document.getElementById(PLAIN_SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.src = PLAIN_SCRIPT_SRC;
    script.id = PLAIN_SCRIPT_ID;
    script.async = true;

    script.onload = () => {
      const plain = getPlain();
      if (!plain || plain.isInitialized()) return;

      plain.init({
        appId,
        theme: "auto",
        hideLauncher: isOnboardingRef.current,
        customerDetails: buildCustomerDetails(),
      });

      plain.onOpen(() => {
        void applyCustomerStatus();
      });

      initializedRef.current = true;
    };

    document.head.appendChild(script);

    return () => {
      const plain = getPlain();
      plain?.close();

      document.getElementById(PLAIN_SCRIPT_ID)?.remove();
      initializedRef.current = false;
      customerStatusSetRef.current = false;
    };
  }, [appId, userId, userEmail, buildCustomerDetails, applyCustomerStatus]);

  // Toggle the launcher when the user moves in or out of onboarding without
  // re-initializing the widget.
  useEffect(() => {
    const plain = getPlain();
    if (!initializedRef.current || !plain?.isInitialized()) return;
    plain.update({ hideLauncher: isOnboarding });
  }, [isOnboarding]);

  return null;
};

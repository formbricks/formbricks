"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { buildPlainCustomerDetails } from "../lib/customer-details";
import { type PlainInitOptions, getPlain, logoutPlain, runPlainStep } from "../lib/plain-sdk";
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

// Init inputs of the currently mounted PlainChat, or null when none is mounted. Module-level
// rather than a ref because the script's onload outlives the instance that injected it: if that
// instance unmounts before the CDN responds, onload must not init with the previous user's
// identity, and the next mount must still be able to init once the script is there.
let mountedInitOptions: PlainInitOptions | null = null;

const initPlainIfReady = () => {
  const plain = getPlain();
  if (plain && mountedInitOptions && !plain.isInitialized()) {
    plain.init(mountedInitOptions);
  }
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

  // Snapshot the latest init inputs so the async script onload reads current
  // values without re-registering the loader on every prop change.
  useEffect(() => {
    mountedInitOptions = {
      appId,
      theme: "auto",
      hideLauncher: isOnboarding,
      style: {
        brandColor: BRAND_COLOR,
        launcherBackgroundColor: BRAND_COLOR,
        launcherIconColor: "#FFFFFF",
      },
      customerDetails: buildPlainCustomerDetails({ userEmail, emailHash, userName, userId }),
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
      script.onload = initPlainIfReady;
      document.head.appendChild(script);
    } else {
      // Script injected by an earlier mount; init now if it loaded after that mount went away.
      initPlainIfReady();
    }

    return () => {
      // Unmounting means a client-side navigation out of the (app) layout, e.g. to a public
      // page. Sign-out is NOT covered here: it ends in a full page load that never unmounts this
      // component, so `useSignOut` logs Plain out itself. The widget's DOM and persisted session
      // outlive this component, so log it out here too; a remount re-applies identity and
      // launcher visibility through the effects below.
      mountedInitOptions = null;
      const plain = getPlain();
      if (plain?.isInitialized()) void logoutPlain(plain);
    };
  }, []);

  // Push identity changes (login, account switch) into the already-initialized
  // widget instead of re-initializing. When no verified identity is available any
  // more, log the widget out so it never keeps acting as the previous user.
  useEffect(() => {
    const plain = getPlain();
    if (!plain?.isInitialized()) return;
    const customerDetails = buildPlainCustomerDetails({ userEmail, emailHash, userName, userId });
    if (!customerDetails) {
      void logoutPlain(plain);
      return;
    }
    void runPlainStep("setCustomer", () => plain.setCustomerDetails(customerDetails));
    // Undo a launcher hidden by an earlier logout.
    void runPlainStep("showLauncher", () =>
      plain.update({ hideLauncher: mountedInitOptions?.hideLauncher ?? false })
    );
  }, [userEmail, emailHash, userName, userId]);

  // Keep the active-customer label in sync once resolved.
  useEffect(() => {
    const plain = getPlain();
    if (!plain?.isInitialized()) return;
    void runPlainStep("updateLabels", () =>
      plain.update({
        threadDetails: activeCustomerLabelTypeId ? { labelTypeIds: [activeCustomerLabelTypeId] } : undefined,
      })
    );
  }, [activeCustomerLabelTypeId]);

  // Toggle the launcher as the user moves in and out of onboarding.
  useEffect(() => {
    const plain = getPlain();
    if (!plain?.isInitialized()) return;
    void runPlainStep("toggleLauncher", () => plain.update({ hideLauncher: isOnboarding }));
  }, [isOnboarding]);

  return null;
};

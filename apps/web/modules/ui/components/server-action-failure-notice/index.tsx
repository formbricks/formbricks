"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { registerUnexpectedServerActionResponseListener } from "@/lib/utils/unexpected-server-action-response";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

/** Matches the notice below, which carries `data-server-action-failure-notice`. */
const NOTICE_SELECTOR = "[data-server-action-failure-notice]";

interface TServerActionFailures {
  /** Bumped on every failure; used as the notice's key so each failure is announced again. */
  failureCount: number;
  isVisible: boolean;
  /** Whether keyboard focus was inside the notice when the latest failure replaced it. */
  restoreFocus: boolean;
  dismiss: () => void;
}

/** Tracks server-action failures nothing else reported (ENG-2899). */
export const useServerActionFailures = (): TServerActionFailures => {
  const [state, setState] = useState({ failureCount: 0, isVisible: false, restoreFocus: false });

  useEffect(
    () =>
      registerUnexpectedServerActionResponseListener(() => {
        const restoreFocus = document.activeElement?.closest(NOTICE_SELECTOR) != null;
        setState((current) => ({ failureCount: current.failureCount + 1, isVisible: true, restoreFocus }));
      }),
    []
  );

  return {
    ...state,
    dismiss: () => setState((current) => ({ ...current, isVisible: false, restoreFocus: false })),
  };
};

interface ServerActionFailureNoticeProps {
  restoreFocus: boolean;
  onDismiss: () => void;
}

/**
 * Tells the user when a server action failed in a way nothing else reported.
 *
 * Something in front of the app -- a load balancer, CDN or WAF -- answered the request with an error
 * page, so whether it ran is unknown. It is not retried automatically for that reason (a retry could
 * apply a write twice), and it does not offer a reload, which on the survey editor would discard
 * unsaved edits. The copy does not assume the user caused the request: some actions run on their own.
 *
 * Rendered by `ServerActionNotices`, keyed by the failure count: each new failure remounts the alert
 * so screen readers announce it again, and if focus was inside the old one it moves to the new one's
 * Close button instead of dropping to the document body.
 */
export const ServerActionFailureNotice = ({
  restoreFocus,
  onDismiss,
}: Readonly<ServerActionFailureNoticeProps>) => {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (restoreFocus) closeButtonRef.current?.focus();
  }, [restoreFocus]);

  return (
    <Alert
      data-server-action-failure-notice=""
      variant="error"
      className="pointer-events-auto max-w-sm shadow-lg">
      <AlertTitle>{t("common.something_went_wrong")}</AlertTitle>
      <AlertDescription>{t("common.action_may_not_have_gone_through")}</AlertDescription>
      <AlertButton ref={closeButtonRef} onClick={onDismiss}>
        {t("common.close")}
      </AlertButton>
    </Alert>
  );
};

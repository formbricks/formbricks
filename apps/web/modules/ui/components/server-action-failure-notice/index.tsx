"use client";

import { type FocusEvent, type MouseEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { registerUnexpectedServerActionResponseListener } from "@/lib/utils/unexpected-server-action-response";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { createFocusReturn } from "./focus-return";

/** Matches the notice below, which carries `data-server-action-failure-notice`. */
const NOTICE_SELECTOR = "[data-server-action-failure-notice]";

interface TServerActionFailures {
  /** Bumped on every failure; used as the notice's key so each failure is announced again. */
  failureCount: number;
  isVisible: boolean;
  /** Whether keyboard focus was inside the notice when the latest failure replaced it. */
  restoreFocus: boolean;
  /** Records where keyboard focus came from when it enters the notice, to hand it back on dismiss. */
  onFocusEnter: (event: FocusEvent<HTMLElement>) => void;
  dismiss: () => void;
}

const isInsideNotice = (element: Element) => element.closest(NOTICE_SELECTOR) !== null;

/** Tracks server-action failures nothing else reported (ENG-2899). */
export const useServerActionFailures = (): TServerActionFailures => {
  const [state, setState] = useState({ failureCount: 0, isVisible: false, restoreFocus: false });
  // Kept here rather than in the notice, which each new failure remounts.
  const [focusReturn] = useState(() => createFocusReturn(isInsideNotice));

  useEffect(
    () =>
      registerUnexpectedServerActionResponseListener(() => {
        const focused = document.activeElement;
        const restoreFocus = focused !== null && isInsideNotice(focused);
        setState((current) => ({ failureCount: current.failureCount + 1, isVisible: true, restoreFocus }));
      }),
    []
  );

  return {
    ...state,
    onFocusEnter: (event) => focusReturn.recordEntry(event.relatedTarget),
    dismiss: () => {
      focusReturn.restore(document.activeElement);
      setState((current) => ({ ...current, isVisible: false, restoreFocus: false }));
    },
  };
};

/**
 * A mouse click on Close must not move focus into the notice: with a modal dialog open, its focus trap
 * would pull focus straight back into the dialog and select the text of the input it lands on, so the
 * user's next keystroke replaces what they typed. Keyboard activation is unaffected.
 */
const keepFocusWhereItIs = (event: MouseEvent<HTMLButtonElement>) => event.preventDefault();

interface ServerActionFailureNoticeProps {
  restoreFocus: boolean;
  onFocusEnter: (event: FocusEvent<HTMLElement>) => void;
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
 * Rendered by `ServerActionNotices`, inside its live region and keyed by the failure count: each new
 * failure remounts the notice so screen readers announce it again, and if focus was inside the old one
 * it moves to the new one's Close button instead of dropping to the document body. Closing it hands
 * focus back to where it came from (`useServerActionFailures`), for the same reason.
 */
export const ServerActionFailureNotice = ({
  restoreFocus,
  onFocusEnter,
  onDismiss,
}: Readonly<ServerActionFailureNoticeProps>) => {
  const { t } = useTranslation();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (restoreFocus) closeButtonRef.current?.focus();
  }, [restoreFocus]);

  return (
    // role="none": the live region around it announces it; role="alert" here would read it twice.
    <Alert
      data-server-action-failure-notice=""
      role="none"
      variant="error"
      className="pointer-events-auto max-w-sm shadow-lg"
      onFocus={onFocusEnter}>
      <AlertTitle>{t("common.something_went_wrong")}</AlertTitle>
      <AlertDescription>{t("common.action_may_not_have_gone_through")}</AlertDescription>
      <AlertButton ref={closeButtonRef} onMouseDown={keepFocusWhereItIs} onClick={onDismiss}>
        {t("common.close")}
      </AlertButton>
    </Alert>
  );
};

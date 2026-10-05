"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { registerUnexpectedServerActionResponseListener } from "@/lib/utils/unexpected-server-action-response";
import { Alert, AlertButton, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";

/**
 * Tells the user when a server action failed in a way nothing else reported (ENG-2899).
 *
 * Something in front of the app -- a load balancer, CDN or WAF -- answered the action with an error
 * page, so whether the action ran is unknown. It is not retried automatically for that reason (a
 * retry could apply a write twice), and it does not offer a reload, which on the survey editor would
 * discard unsaved edits. The user is asked to check and try again, which is the one safe next step.
 *
 * Each new failure remounts the alert, so screen readers announce it again rather than staying
 * silent while an earlier notice is still on screen.
 */
export const ServerActionFailureNotice = () => {
  const { t } = useTranslation();
  const [failureCount, setFailureCount] = useState(0);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(
    () =>
      registerUnexpectedServerActionResponseListener(() => {
        setFailureCount((count) => count + 1);
        setIsDismissed(false);
      }),
    []
  );

  if (isDismissed) {
    return null;
  }

  return (
    <Alert key={failureCount} variant="error" className="pointer-events-auto max-w-sm shadow-lg">
      <AlertTitle>{t("common.something_went_wrong")}</AlertTitle>
      <AlertDescription>{t("common.action_may_not_have_gone_through")}</AlertDescription>
      <AlertButton onClick={() => setIsDismissed(true)}>{t("common.close")}</AlertButton>
    </Alert>
  );
};

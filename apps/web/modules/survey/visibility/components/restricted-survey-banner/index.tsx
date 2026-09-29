"use client";

import { InfoIcon, XIcon } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  readRestrictedBannerDismissed,
  writeRestrictedBannerDismissed,
} from "@/modules/survey/visibility/lib/markers";
import { Alert, AlertButton } from "@/modules/ui/components/alert";

interface RestrictedSurveyBannerProps {
  surveyId: string;
  /** The author's name; `null` when the author no longer has an account. */
  ownerName: string | null;
  className?: string;
}

// Nothing notifies about sessionStorage changes within the tab; the dismiss click updates local state.
const subscribeToNothing = () => () => undefined;

const getSessionStorage = (): Storage | undefined => {
  try {
    return globalThis.window === undefined ? undefined : globalThis.window.sessionStorage;
  } catch {
    return undefined;
  }
};

/**
 * Tells an organization owner or manager that they see a restricted survey only through their role.
 * The caller decides whether it applies (`showRestrictedBanner`). The server renders it open (its
 * snapshot is "not dismissed"); a dismissal lasts for this survey for the rest of the browser session.
 */
export const RestrictedSurveyBanner = ({
  surveyId,
  ownerName,
  className,
}: Readonly<RestrictedSurveyBannerProps>) => {
  const { t } = useTranslation();
  const [isDismissedNow, setIsDismissedNow] = useState(false);
  const wasDismissed = useSyncExternalStore(
    subscribeToNothing,
    () => readRestrictedBannerDismissed(getSessionStorage(), surveyId),
    () => false
  );

  if (isDismissedNow || wasDismissed) return null;

  const handleDismiss = () => {
    writeRestrictedBannerDismissed(getSessionStorage(), surveyId);
    setIsDismissedNow(true);
  };

  return (
    <Alert variant="default" size="small" role="status" className={className}>
      <InfoIcon className="text-slate-500" aria-hidden="true" />
      <p className="grow text-slate-700">
        {ownerName
          ? t("workspace.surveys.visibility.banner_role_access", { author: ownerName })
          : t("workspace.surveys.visibility.banner_role_access_no_author")}
      </p>
      <AlertButton variant="ghost" size="icon" aria-label={t("common.close")} onClick={handleDismiss}>
        <XIcon />
      </AlertButton>
    </Alert>
  );
};

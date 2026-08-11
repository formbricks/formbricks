import { useEffect, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";

interface AutoCloseProgressBarProps {
  autoCloseTimeout: number;
}

export function AutoCloseProgressBar({ autoCloseTimeout }: Readonly<AutoCloseProgressBarProps>) {
  const { t } = useTranslation();
  const announcementText = t("common.survey_closes_automatically_in_x_seconds", {
    count: autoCloseTimeout,
  });
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    setAnnouncement("");
    const timeoutId = setTimeout(() => setAnnouncement(announcementText), 0);

    return () => clearTimeout(timeoutId);
  }, [announcementText]);

  return (
    <>
      {/* The countdown is driven by a CSS animation, so there is no value to keep in sync: this is an
          indeterminate progressbar, which in ARIA means omitting aria-valuenow. Declaring a value we
          could not update would be worse than declaring none. */}
      <div // NOSONAR(typescript:S6819) - a native <progress> cannot run this CSS shrink animation
        className="bg-accent-bg h-2 w-full overflow-hidden"
        role="progressbar"
        aria-label={t("common.time_remaining_before_the_survey_closes")}>
        <div
          key={autoCloseTimeout}
          className="bg-brand z-20 h-2"
          style={{
            animation: `shrink-width-to-zero ${autoCloseTimeout.toString()}s linear forwards`,
            width: "100%",
          }}
        />
      </div>
      {/* Mount the live region empty, then populate it after a tick so assistive technology observes
          a content change. The bar stays silent because an indeterminate progressbar has no value to
          report, and role="timer" would re-announce on every tick. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </>
  );
}

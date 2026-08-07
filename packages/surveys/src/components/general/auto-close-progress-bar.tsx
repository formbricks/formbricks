import { useTranslation } from "react-i18next";

interface AutoCloseProgressBarProps {
  autoCloseTimeout: number;
}

export function AutoCloseProgressBar({ autoCloseTimeout }: Readonly<AutoCloseProgressBarProps>) {
  const { t } = useTranslation();

  return (
    <>
      {/* The countdown is driven by a CSS animation, so there is no value to keep in sync: this is an
          indeterminate progressbar, which in ARIA means omitting aria-valuenow. Declaring a value we
          could not update would be worse than declaring none. */}
      <div
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
      {/* A shrinking bar conveys the deadline visually only. This states it once, politely, when the
          countdown mounts. The bar itself stays silent — an indeterminate progressbar has nothing to
          report — and role="timer" was avoided because it would re-announce on every tick. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {t("common.survey_closes_automatically_in_x_seconds", { count: autoCloseTimeout })}
      </div>
    </>
  );
}

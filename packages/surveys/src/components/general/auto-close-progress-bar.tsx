import { useEffect, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";

interface AutoCloseProgressBarProps {
  autoCloseTimeout: number;
}

export function AutoCloseProgressBar({ autoCloseTimeout }: AutoCloseProgressBarProps) {
  const { t } = useTranslation();
  const autoCloseSeconds = Math.max(0, Math.ceil(autoCloseTimeout));
  const [secondsRemaining, setSecondsRemaining] = useState(autoCloseSeconds);

  useEffect(() => {
    setSecondsRemaining(autoCloseSeconds);
    if (autoCloseSeconds === 0) return;

    const interval = setInterval(() => {
      setSecondsRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [autoCloseSeconds]);

  return (
    <>
      <span className="sr-only" role="status" aria-live="polite">
        {t("common.auto_close_announcement")}
      </span>
      <div
        className="bg-accent-bg h-2 w-full overflow-hidden"
        role="progressbar"
        aria-label={t("common.auto_close_countdown")}
        aria-valuemin={0}
        aria-valuemax={autoCloseSeconds}
        aria-valuenow={secondsRemaining}>
        <div
          key={autoCloseTimeout}
          className="bg-brand z-20 h-2"
          style={{
            animation: `shrink-width-to-zero ${autoCloseTimeout.toString()}s linear forwards`,
            width: "100%",
          }}
        />
      </div>
    </>
  );
}

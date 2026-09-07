import { useTranslation } from "react-i18next";

export function Progress({ progress }: Readonly<{ progress: number }>) {
  const { t } = useTranslation();
  // One value drives both the painted width and aria-valuenow, so what a screen reader
  // reports can never drift from what is on screen. Clamped because callers derive
  // `progress` from block arithmetic and a value outside 0..1 would fall outside the
  // min/max this element declares. Floor (not round) keeps the existing visual width.
  const percent = Math.floor(Math.min(Math.max(progress, 0), 1) * 100);

  return (
    <div // NOSONAR(typescript:S6819) - a native <progress> cannot be themed from the survey's CSS variables
      className="progress-track h-2 w-full overflow-hidden rounded-none"
      role="progressbar"
      aria-label={t("common.survey_progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}>
      <div
        className="transition-width progress-indicator z-20 h-full duration-500"
        style={{
          width: `${percent.toString()}%`,
        }}
      />
    </div>
  );
}

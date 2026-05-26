import { useTranslation } from "react-i18next";

export function Progress({ progress }: { progress: number }) {
  const { t } = useTranslation();
  const progressPercentage = Math.floor(progress * 100);

  return (
    <div
      className="progress-track h-2 w-full overflow-hidden rounded-none"
      role="progressbar"
      aria-label={t("common.survey_progress")}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progressPercentage}>
      <div
        className="transition-width progress-indicator z-20 h-full duration-500"
        style={{
          width: `${progressPercentage.toString()}%`,
        }}
      />
    </div>
  );
}

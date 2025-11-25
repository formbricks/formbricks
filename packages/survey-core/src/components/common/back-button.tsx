import { useTranslation } from "react-i18next";
import { cn } from "../../lib/utils";

interface BackButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
  tabIndex?: number;
  className?: string;
}

export function BackButton({ onClick, backButtonLabel, tabIndex = 2 }: BackButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      dir="auto"
      tabIndex={tabIndex}
      type="button"
      className={cn(
        "hover:bg-input-bg text-heading focus:ring-focus rounded-custom mb-1 flex items-center px-3 py-3 text-base font-medium leading-4 focus:outline-none focus:ring-2 focus:ring-offset-2"
      )}
      onClick={onClick}>
      {backButtonLabel || t("common.back")}
    </button>
  );
}

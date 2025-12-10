import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
  tabIndex?: number;
}

export function BackButton({ onClick, backButtonLabel, tabIndex = 2 }: BackButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      dir="auto"
      tabIndex={tabIndex}
      type="button"
      className={cn(
        "fb:mb-1 fb:hover:bg-input-bg fb:text-heading fb:focus:ring-focus fb:rounded-custom fb:flex fb:items-center fb:px-3 fb:py-3 fb:text-base fb:font-medium fb:leading-4 fb:focus:outline-hidden fb:focus:ring-2 fb:focus:ring-offset-2"
      )}
      onClick={onClick}>
      {backButtonLabel || t("common.back")}
    </button>
  );
}

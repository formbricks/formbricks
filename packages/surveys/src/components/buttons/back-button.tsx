import { useTranslation } from "react-i18next";
import { FB_PART } from "@formbricks/survey-ui/parts";
import { Button } from "./button";

interface BackButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
  tabIndex?: number;
}

export function BackButton({ onClick, backButtonLabel, tabIndex = 0 }: Readonly<BackButtonProps>) {
  const { t } = useTranslation();
  return (
    <Button
      dir="auto"
      tabIndex={tabIndex}
      type="button"
      variant="ghost"
      data-fb-part={FB_PART.buttonBack}
      onClick={onClick}>
      {backButtonLabel || t("common.back")}
    </Button>
  );
}

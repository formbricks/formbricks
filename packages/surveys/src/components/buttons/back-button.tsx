import { useTranslation } from "react-i18next";
import { Button } from "./button";

interface BackButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
  tabIndex?: number;
}

export function BackButton({ onClick, backButtonLabel, tabIndex = 2 }: Readonly<BackButtonProps>) {
  const { t } = useTranslation();
  return (
    <Button dir="auto" tabIndex={tabIndex} type="button" variant="ghost" onClick={onClick}>
      {backButtonLabel || t("common.back")}
    </Button>
  );
}

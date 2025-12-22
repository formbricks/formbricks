import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { CloseIcon } from "@/components/icons/close-icon";
import { mixColor } from "@/lib/color";
import { cn } from "@/lib/utils";

interface SurveyCloseButtonProps {
  onClose?: () => void;
  hoverColor?: string;
  borderRadius?: number;
}

export function SurveyCloseButton({ onClose, hoverColor, borderRadius }: Readonly<SurveyCloseButtonProps>) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const hoverColorWithOpacity = hoverColor ?? mixColor("#000000", "#ffffff", 0.8);

  return (
    <div className="z-1001 flex w-fit items-center">
      <button
        type="button"
        onClick={onClose}
        style={{
          backgroundColor: isHovered ? hoverColorWithOpacity : "transparent",
          transition: "background-color 0.2s ease",
          borderRadius: `${borderRadius}px`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "text-heading relative flex h-8 w-8 items-center justify-center p-2 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
        )}
        aria-label={t("common.close_survey")}>
        <CloseIcon />
      </button>
    </div>
  );
}

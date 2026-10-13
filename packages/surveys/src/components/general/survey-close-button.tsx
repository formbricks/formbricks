import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { FB_PART } from "@formbricks/survey-ui/parts";
import { CloseIcon } from "@/components/icons/close-icon";
import { mixColor } from "@/lib/color";

// Insets the close button's row from the card's rounded corner: a square inset by 0.3 × radius stays
// inside the arc (the exact bound is 1 - 1/√2 ≈ 0.293). A card never renders a radius above half its width,
// so the inset is capped at 15% of the row width (0.3 × 50%) rather than growing with any configured value.
// Written out literally so Tailwind can detect it.
export const SURVEY_CLOSE_BUTTON_ROW_CLASS_NAME =
  "pt-[clamp(4px,calc(var(--fb-border-radius)*0.3),15%)] pe-[clamp(4px,calc(var(--fb-border-radius)*0.3),15%)]";

interface SurveyCloseButtonProps {
  onClose?: () => void;
  hoverColor?: string;
  borderRadius?: number | string;
}

export function SurveyCloseButton({ onClose, hoverColor, borderRadius }: Readonly<SurveyCloseButtonProps>) {
  const { t } = useTranslation();
  const [isHovered, setIsHovered] = useState(false);
  const hoverColorWithOpacity = hoverColor ?? mixColor("#000000", "#ffffff", 0.8);

  return (
    <div className="z-1001 flex w-fit items-center">
      <button
        type="button"
        data-fb-part={FB_PART.buttonClose}
        onClick={onClose}
        style={{
          backgroundColor: isHovered ? hoverColorWithOpacity : "transparent",
          transition: "background-color 0.2s ease",
          borderRadius: typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="text-heading relative flex h-11 w-11 items-center justify-center"
        aria-label={t("common.close_survey")}>
        <CloseIcon />
      </button>
    </div>
  );
}

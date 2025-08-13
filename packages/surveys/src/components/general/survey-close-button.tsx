import { CloseIcon } from "@/components/icons/close-icon";
import { mixColor } from "@/lib/color";
import { cn } from "@/lib/utils";
import { useState } from "preact/hooks";

interface SurveyCloseButtonProps {
  onClose?: () => void;
  hoverColor?: string;
  borderRadius?: number;
}

export function SurveyCloseButton({ onClose, hoverColor, borderRadius }: Readonly<SurveyCloseButtonProps>) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverColorWithOpacity = hoverColor ?? mixColor("#000000", "#ffffff", 0.8);

  return (
    <div className="fb-z-[1001] fb-flex fb-w-fit fb-items-center">
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
          "fb-text-heading fb-relative focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 fb-p-2 fb-h-8 fb-w-8 flex items-center justify-center"
        )}
        aria-label="Close survey">
        <CloseIcon />
      </button>
    </div>
  );
}

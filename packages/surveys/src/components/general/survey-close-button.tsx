import { CloseIcon } from "@/components/icons/close-icon";
import { cn } from "@/lib/utils";

interface SurveyCloseButtonProps {
  onClose?: () => void;
  borderRadius?: number;
}

export function SurveyCloseButton({ onClose, borderRadius }: Readonly<SurveyCloseButtonProps>) {
  return (
    <div className="fb-z-[1001] fb-flex fb-w-fit fb-items-center">
      <button
        type="button"
        onClick={onClose}
        style={{
          transition: "background-color 0.2s ease",
          borderRadius: `${borderRadius}px`,
        }}
        className={cn(
          "fb-text-heading fb-relative hover:fb-bg-input-bg focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 fb-p-2 fb-h-8 fb-w-8 flex items-center justify-center"
        )}
        aria-label="Close survey">
        <CloseIcon />
      </button>
    </div>
  );
}

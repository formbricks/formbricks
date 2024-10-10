import { cn } from "@/lib/utils";

interface BackButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
  tabIndex?: number;
}

export const BackButton = ({ onClick, backButtonLabel, tabIndex = 2 }: BackButtonProps) => {
  return (
    <button
      dir="auto"
      tabIndex={tabIndex}
      type={"button"}
      className={cn(
        "fb-border-back-button-border fb-text-heading focus:fb-ring-focus fb-rounded-custom fb-flex fb-items-center fb-border fb-px-3 fb-py-3 fb-text-base fb-leading-4 fb-font-medium hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 " +
          "hover:fb-shadow-lg fb-shadow-[0_4px_6px_rgba(0,0,0,0.2)] fb-shadow-gray-500"
      )}
      onClick={onClick}>
      {backButtonLabel || "Back"}
    </button>
  );
};

import { cn } from "@/lib/utils";

interface BackButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
  tabIndex?: number;
}

export function BackButton({ onClick, backButtonLabel, tabIndex = 2 }: BackButtonProps) {
  return (
    <button
      dir="auto"
      tabIndex={tabIndex}
      type="button"
      className={cn(
        "fb-mb-1 hover:fb-bg-input-bg fb-text-heading focus:fb-ring-focus fb-rounded-custom fb-flex fb-items-center fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2"
      )}
      onClick={onClick}>
      {backButtonLabel || "Back"}
    </button>
  );
}

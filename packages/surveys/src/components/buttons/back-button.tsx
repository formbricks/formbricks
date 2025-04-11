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
        "border-back-button-border text-heading focus:ring-focus rounded-custom flex items-center border px-3 py-3 text-base font-medium leading-4 shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2"
      )}
      onClick={onClick}>
      {backButtonLabel || "Back"}
    </button>
  );
}

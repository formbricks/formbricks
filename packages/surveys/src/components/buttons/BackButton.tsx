import { cn } from "../../../../lib/cn";

interface BackButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
  tabIndex?: number;
}

export function BackButton({ onClick, backButtonLabel, tabIndex = 2 }: BackButtonProps) {
  return (
    <button
      tabIndex={tabIndex}
      type={"button"}
      className={cn(
        "flex items-center rounded-md border border-[--fb-back-btn-border] px-3 py-3 text-base font-medium leading-4 text-[--fb-heading-color] shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[--fb-element-focus-color] focus:ring-offset-2"
      )}
      onClick={onClick}>
      {backButtonLabel || "Back"}
    </button>
  );
}

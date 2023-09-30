import { cn } from "../../../../lib/cn";

interface BackButtonProps {
  onClick: () => void;
  backButtonLabel?: string;
}

export function BackButton({ onClick, backButtonLabel }: BackButtonProps) {
  return (
    <button
      type={"button"}
      className={cn(
        "flex items-center rounded-md border border-[var(--fb-back-btn-border)] px-3 py-3 text-base font-medium leading-4 shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--fb-back-btn-focus-ring)] focus:ring-offset-2"
      )}
      onClick={onClick}>
      {backButtonLabel || "Back"}
    </button>
  );
}

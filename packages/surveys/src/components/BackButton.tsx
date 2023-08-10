import { cn } from "../../../lib/cn";

interface BackButtonProps {
  onClick: () => void;
}

export function BackButton({ onClick }: BackButtonProps) {
  return (
    <button
      type={"button"}
      className={cn(
        "fb-flex fb-items-center fb-rounded-md fb-border fb-border-transparent fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-slate-500 focus:fb-ring-offset-2"
      )}
      onClick={onClick}>
      Back
    </button>
  );
}

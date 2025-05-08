// @ts-nocheck
import { ButtonHTMLAttributes, useRef } from "react";
import { useCallback, useEffect } from "react";
import { cn } from "@formbricks/lib/cn";
import { LoadingSpinner } from "../general/loading-spinner";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  buttonLabel: string | undefined;
  isLastQuestion: boolean;
  focus?: boolean;
  className?: string;
  isLoading?: boolean;
}

export function SubmitButton({
  buttonLabel,
  isLastQuestion,
  tabIndex = 1,
  focus = false,
  onClick,
  disabled,
  type,
  className = "",
  isLoading = false,
  ...props
}: SubmitButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !disabled && !isLoading) {
        event.preventDefault();
        const button = buttonRef.current;
        if (button) {
          button.click();
        }
      }
    },
    [disabled, isLoading]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (buttonRef.current && focus) {
      setTimeout(() => {
        buttonRef.current?.focus();
      }, 200);
    }
  }, [focus]);

  return (
    <button
      {...props}
      dir="auto"
      ref={buttonRef}
      type={type}
      tabIndex={tabIndex}
      autoFocus={focus}
      className={cn(
        "bg-brand border-submit-button-border text-on-brand focus:ring-focus rounded-custom flex items-center border px-3 py-3 text-base font-medium leading-4 shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2",
        isLoading ? "cursor-not-allowed" : "",
        className
      )}
      onClick={onClick}
      disabled={disabled || isLoading}>
      {isLoading ? <LoadingSpinner size="sm" /> : buttonLabel || isLastQuestion ? "Finish" : "Next"}
    </button>
  );
}

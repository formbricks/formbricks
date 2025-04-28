import { ButtonHTMLAttributes, useRef } from "preact/compat";
import { useCallback, useEffect } from "preact/hooks";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  buttonLabel?: string;
  isLastQuestion: boolean;
  focus?: boolean;
}

export function SubmitButton({
  buttonLabel,
  isLastQuestion,
  tabIndex = 1,
  focus = false,
  onClick,
  disabled,
  type,
  ...props
}: SubmitButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !disabled) {
        event.preventDefault();
        const button = buttonRef.current;
        if (button) {
          button.click();
        }
      }
    },
    [disabled]
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
      className="fb-bg-brand fb-border-submit-button-border fb-text-on-brand focus:fb-ring-focus fb-rounded-custom fb-flex fb-items-center fb-border fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-shadow-sm hover:fb-opacity-90 focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2"
      onClick={onClick}
      disabled={disabled}>
      {buttonLabel ?? (isLastQuestion ? "Finish" : "Next")}
    </button>
  );
}

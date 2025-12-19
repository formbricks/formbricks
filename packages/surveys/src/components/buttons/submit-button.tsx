import { ButtonHTMLAttributes, useRef } from "preact/compat";
import { useCallback, useEffect, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";

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
  const [isProcessing, setIsProcessing] = useState(false);

  // throttle the button submit to prevent multiple submissions
  // works by setting a timeout to reset the isProcessing state
  // TODO: Refactor
  useEffect(() => {
    if (isProcessing) {
      const timer = setTimeout(() => {
        setIsProcessing(false);
      }, 300);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [isProcessing]);
  const { t } = useTranslation();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !disabled && !isProcessing) {
        event.preventDefault();
        setIsProcessing(true);
        const button = buttonRef.current;
        if (button) {
          button.click();
        }
      }
    },
    [disabled, isProcessing]
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
      className="bg-brand border-submit-button-border text-on-brand focus:ring-focus rounded-custom mb-1 flex items-center border px-3 py-3 text-base leading-4 font-medium shadow-xs hover:opacity-90 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
      onClick={onClick}
      disabled={disabled}>
      {buttonLabel || (isLastQuestion ? t("common.finish") : t("common.next"))}
    </button>
  );
}

import { JSX } from "preact";
import { useCallback } from "preact/hooks";

interface SubmitButtonProps extends JSX.HTMLAttributes<HTMLButtonElement> {
  buttonLabel: string | undefined;
  isLastQuestion: boolean;
  focus?: boolean;
}

export const SubmitButton = ({
  buttonLabel,
  isLastQuestion,
  tabIndex = 1,
  focus = false,
  onClick,
  disabled,
  type,
  ...props
}: SubmitButtonProps) => {
  const buttonRef = useCallback(
    (currentButton: HTMLButtonElement | null) => {
      if (currentButton && focus) {
        setTimeout(() => {
          currentButton.focus();
        }, 200);
      }
    },
    [focus]
  );

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
      {buttonLabel || (isLastQuestion ? "Finish" : "Next")}
    </button>
  );
};

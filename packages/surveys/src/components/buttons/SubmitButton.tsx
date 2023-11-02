import { useCallback } from "preact/hooks";

interface SubmitButtonProps {
  buttonLabel: string | undefined;
  isLastQuestion: boolean;
  onClick: () => void;
  focus?: boolean;
  tabIndex?: number;
  type?: "submit" | "button";
  brandColor: string;
}

function SubmitButton({
  buttonLabel,
  isLastQuestion,
  onClick,
  tabIndex = 1,
  focus = false,
  type = "submit",
  brandColor,
}: SubmitButtonProps) {
  const buttonRef = useCallback((currentButton: HTMLButtonElement | null) => {
    if (currentButton && focus) {
      setTimeout(() => {
        currentButton.focus();
      }, 200);
    }
  }, []);

  return (
    <button
      ref={buttonRef}
      type={type}
      tabIndex={tabIndex}
      autoFocus={focus}
      className="flex items-center rounded-md border border-[--fb-submit-btn-border] bg-[--fb-brand-color] px-3 py-3 text-base font-medium leading-4 text-[--fb-brand-text-color] shadow-sm hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[--fb-focus-color] focus:ring-offset-2"
      style={{ backgroundColor: brandColor }}
      onClick={onClick}>
      {buttonLabel || (isLastQuestion ? "Finish" : "Next")}
    </button>
  );
}
export default SubmitButton;

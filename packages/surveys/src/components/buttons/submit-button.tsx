import { type ButtonHTMLAttributes } from "preact";
import { useRef } from "preact/compat";
import { useCallback, useEffect, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { Button } from "./button";

interface SubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  buttonLabel?: string;
  isLastQuestion: boolean;
  focus?: boolean;
}

export function SubmitButton({
  buttonLabel,
  isLastQuestion,
  tabIndex = 0,
  focus = false,
  onClick,
  disabled,
  type,
  ...props
}: Readonly<SubmitButtonProps>) {
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
        // The listener sits on `document` so the chord still works when focus is on <body>, which is
        // the normal state for link surveys. An embedded survey shares the page with a host app that
        // owns its own shortcuts, so don't claim the chord — or preventDefault it — while the user is
        // focused inside their page.
        const surveyRoot = buttonRef.current?.closest("#fbjs");
        const activeElement = document.activeElement;
        if (
          surveyRoot &&
          activeElement &&
          activeElement !== document.body &&
          !surveyRoot.contains(activeElement)
        ) {
          return;
        }

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

  // The button sits *below* the headline and subheader of a welcome or ending card, inside
  // `ScrollableContainer`. Letting focus scroll it into view opens an overflowing card at its end, so
  // the respondent lands on the button with the text they have yet to read scrolled out of view
  // (ENG-2289) — hence `preventScroll`. For the same reason the button carries no `autoFocus`
  // attribute: the browser's autofocus step has no `preventScroll` knob, and this delayed focus
  // (deferred so the card transition has settled) is the intended focus path anyway.
  useEffect(() => {
    if (buttonRef.current && focus) {
      const timeoutId = setTimeout(() => {
        buttonRef.current?.focus({ preventScroll: true });
      }, 200);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [focus]);

  return (
    <Button
      {...props}
      dir="auto"
      variant="primary"
      ref={buttonRef}
      type={type}
      tabIndex={tabIndex}
      onClick={onClick}
      disabled={disabled}>
      {buttonLabel || (isLastQuestion ? t("common.finish") : t("common.next"))}
    </Button>
  );
}

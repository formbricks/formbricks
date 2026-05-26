import React from "preact/compat";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { type TJsWorkspaceStateSurvey } from "@formbricks/types/js";
import { AutoCloseProgressBar } from "@/components/general/auto-close-progress-bar";

interface AutoCloseProps {
  survey: TJsWorkspaceStateSurvey;
  questionIdx: number;
  onClose?: () => void;
  children: React.ReactNode;
  hasInteracted: boolean;
  setHasInteracted: (hasInteracted: boolean) => void;
}

export function AutoCloseWrapper({
  survey,
  onClose,
  children,
  questionIdx,
  hasInteracted,
  setHasInteracted,
}: AutoCloseProps) {
  const [countDownActive, setCountDownActive] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAppSurvey = survey.type === "app";

  const isFirstQuestion = useMemo(() => {
    if (survey.welcomeCard.enabled) return questionIdx === -1;
    return questionIdx === 0;
  }, [questionIdx, survey.welcomeCard.enabled]);

  const showAutoCloseProgressBar = countDownActive && isAppSurvey && isFirstQuestion && !hasInteracted;

  const startCountdown = () => {
    if (!survey.autoClose || !isFirstQuestion || hasInteracted) return;

    if (timeoutRef.current) {
      stopCountdown();
    }
    setCountDownActive(true);
    timeoutRef.current = setTimeout(() => {
      onClose?.();
      setCountDownActive(false);
    }, survey.autoClose * 1000);
  };

  const stopCountdown = () => {
    setCountDownActive(false);
    setHasInteracted(true); // Mark that user has interacted

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  useEffect(() => {
    startCountdown();
    return stopCountdown;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- we don't want to run this effect on every render
  }, [survey.autoClose]);

  return (
    <div className="flex h-full w-full flex-col">
      <div // NOSONAR // We can't have a role="button" here as sonarqube registers more issues with this. This is indeed an interactive element.
        onClick={stopCountdown}
        onMouseOver={stopCountdown} // NOSONAR // We can't check for onFocus because the survey is auto focused after the first question and we don't want to stop the countdown
        className="h-full w-full"
        data-testid="fb__surveys__auto-close-wrapper-test"
        onKeyDown={stopCountdown}
        onTouchStart={stopCountdown}>
        {children}
      </div>
      {survey.type === "app" && survey.autoClose && (
        <div className="h-2 w-full" aria-hidden={!showAutoCloseProgressBar}>
          {showAutoCloseProgressBar && <AutoCloseProgressBar autoCloseTimeout={survey.autoClose} />}
        </div>
      )}
    </div>
  );
}

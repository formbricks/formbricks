import { AutoCloseProgressBar } from "@/components/general/auto-close-progress-bar";
import React from "preact/compat";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";

interface AutoCloseProps {
  survey: TJsEnvironmentStateSurvey;
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
    <div className="fb:h-full fb:w-full">
      {survey.autoClose && showAutoCloseProgressBar ? (
        <AutoCloseProgressBar autoCloseTimeout={survey.autoClose} />
      ) : null}
      <div onClick={stopCountdown} onMouseOver={stopCountdown} className="fb:h-full fb:w-full">
        {children}
      </div>
    </div>
  );
}

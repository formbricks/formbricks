import { AutoCloseProgressBar } from "@/components/general/auto-close-progress-bar";
import React from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";
import { type TJsEnvironmentStateSurvey } from "@formbricks/types/js";

interface AutoCloseProps {
  survey: TJsEnvironmentStateSurvey;
  onClose?: () => void;
  offset: number;
  children: React.ReactNode;
}

export function AutoCloseWrapper({ survey, onClose, children, offset }: AutoCloseProps) {
  const [countDownActive, setCountDownActive] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAppSurvey = survey.type === "app";
  const showAutoCloseProgressBar = countDownActive && isAppSurvey && offset === 0;

  const startCountdown = () => {
    if (!survey.autoClose) return;

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
    <div className="fb-h-full fb-w-full">
      {survey.autoClose && showAutoCloseProgressBar ? (
        <AutoCloseProgressBar autoCloseTimeout={survey.autoClose} />
      ) : null}
      <div onClick={stopCountdown} onMouseOver={stopCountdown} className="fb-h-full fb-w-full">
        {children}
      </div>
    </div>
  );
}

import { AutoCloseProgressBar } from "@/components/general/AutoCloseProgressBar";
import React from "preact/compat";
import { useEffect, useRef, useState } from "preact/hooks";

import { TSurvey } from "@formbricks/types/surveys";

interface AutoCloseProps {
  survey: TSurvey;
  onClose: () => void;
  children: React.ReactNode;
}

export function AutoCloseWrapper({ survey, onClose, children }: AutoCloseProps) {
  const [countDownActive, setCountDownActive] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showAutoCloseProgressBar = countDownActive && survey.type === "web";

  const startCountdown = () => {
    if (!survey.autoClose) return;

    if (timeoutRef.current) {
      stopCountdown();
    }
    setCountDownActive(true);
    timeoutRef.current = setTimeout(() => {
      onClose();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [survey.autoClose]);

  return (
    <div>
      {survey.autoClose && showAutoCloseProgressBar && (
        <AutoCloseProgressBar autoCloseTimeout={survey.autoClose} />
      )}
      <div onClick={stopCountdown} onMouseOver={stopCountdown} className="h-full w-full">
        {children}
      </div>
    </div>
  );
}

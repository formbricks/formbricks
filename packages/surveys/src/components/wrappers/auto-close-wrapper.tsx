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
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Cancel the countdown on the first interaction. Listeners are attached to the
  // container (events bubble up from the children) so the wrapper stays a plain,
  // non-interactive element, with no role or aria-label that a screen reader
  // would wrongly announce. onFocus is intentionally excluded: the survey
  // auto-focuses its first field, which must not count as a user interaction.
  useEffect(() => {
    const node = containerRef.current;
    if (!node || !survey.autoClose || !isFirstQuestion) return;

    const handleInteraction = (): void => {
      stopCountdown();
    };
    const passive: AddEventListenerOptions = { passive: true };
    // click is included alongside pointerdown because assistive tech, switch, and
    // voice control can synthesize a click without a preceding pointer/key event.
    node.addEventListener("pointerdown", handleInteraction, passive);
    node.addEventListener("click", handleInteraction, passive);
    node.addEventListener("mouseover", handleInteraction, passive);
    node.addEventListener("touchstart", handleInteraction, passive);
    node.addEventListener("keydown", handleInteraction, passive);

    return () => {
      node.removeEventListener("pointerdown", handleInteraction);
      node.removeEventListener("click", handleInteraction);
      node.removeEventListener("mouseover", handleInteraction);
      node.removeEventListener("touchstart", handleInteraction);
      node.removeEventListener("keydown", handleInteraction);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stopCountdown only touches stable setters/refs
  }, [survey.autoClose, isFirstQuestion]);

  return (
    <div className="flex h-full w-full flex-col">
      <div ref={containerRef} className="h-full w-full" data-testid="fb__surveys__auto-close-wrapper-test">
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

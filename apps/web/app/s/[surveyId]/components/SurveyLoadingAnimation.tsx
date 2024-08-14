import Logo from "@/images/powered-by-formbricks.svg";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys/types";
import { LoadingSpinner } from "@formbricks/ui/LoadingSpinner";

interface SurveyLoadingAnimationProps {
  survey: TSurvey;
}

export const SurveyLoadingAnimation = ({ survey }: SurveyLoadingAnimationProps) => {
  const [isHidden, setIsHidden] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [isMediaLoaded, setIsMediaLoaded] = useState(false);
  const [isSurveyPackageLoaded, setIsSurveyPackageLoaded] = useState(false);

  const cardId = survey.welcomeCard.enabled ? `questionCard--1` : `questionCard-0`;

  const checkMediaLoaded = useCallback(() => {
    const cardElement = document.getElementById(cardId);
    const images = cardElement ? Array.from(cardElement.getElementsByTagName("img")) : [];
    const allLoaded = images.every((img) => img.complete && img.naturalHeight !== 0);

    if (allLoaded) {
      setIsMediaLoaded(true);
    }
  }, [cardId]);

  useEffect(() => {
    if (!isSurveyPackageLoaded) return;

    checkMediaLoaded();

    const imgElements = document.querySelectorAll(`#${cardId} img`);
    imgElements.forEach((img) => img.addEventListener("load", checkMediaLoaded));

    return () => {
      imgElements.forEach((img) => img.removeEventListener("load", checkMediaLoaded));
    };
  }, [isSurveyPackageLoaded, checkMediaLoaded, cardId]);

  useEffect(() => {
    if (isMediaLoaded && minTimePassed) {
      const hideTimer = setTimeout(() => {
        setIsHidden(true);
      }, 1500);

      return () => clearTimeout(hideTimer);
    } else {
      setIsHidden(false);
    }
  }, [isMediaLoaded, minTimePassed]);

  useEffect(() => {
    // Ensure the animation is shown for at least 1.5 seconds
    const minTimeTimer = setTimeout(() => {
      setMinTimePassed(true);
    }, 1500);
    const observer = new MutationObserver((mutations) => {
      mutations.some((mutation) => {
        if (mutation.addedNodes.length) {
          setIsSurveyPackageLoaded(true);
          observer.disconnect();
          return true;
        }
        return false;
      });
    });

    const targetNode = document.getElementById("formbricks-survey-container");
    if (targetNode) {
      observer.observe(targetNode, { childList: true });
    }

    return () => {
      observer.disconnect();
      clearTimeout(minTimeTimer);
    };
  }, []);

  return (
    <div
      className={cn(
        "absolute inset-0 z-[5000] flex items-center justify-center transition-colors duration-1000",
        isMediaLoaded && minTimePassed ? "bg-transparent" : "bg-white",
        isHidden && "hidden"
      )}>
      <div
        className={cn(
          isMediaLoaded && minTimePassed
            ? "animate-surveyExit flex flex-col items-center space-y-4"
            : "animate-surveyLoading flex flex-col items-center space-y-4"
        )}>
        <Image src={Logo} alt="Logo" className={cn("w-32 transition-all duration-1000 md:w-40")} />
        <LoadingSpinner />
      </div>
    </div>
  );
};

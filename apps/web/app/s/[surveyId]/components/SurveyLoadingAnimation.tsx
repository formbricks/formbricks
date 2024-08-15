import Logo from "@/images/powered-by-formbricks.svg";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { TSurvey } from "@formbricks/types/surveys/types";
import { LoadingSpinner } from "@formbricks/ui/LoadingSpinner";

interface SurveyLoadingAnimationProps {
  survey: TSurvey;
  isBackgroundLoaded?: boolean;
}

export const SurveyLoadingAnimation = ({
  survey,
  isBackgroundLoaded = true,
}: SurveyLoadingAnimationProps) => {
  const [isHidden, setIsHidden] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [isMediaLoaded, setIsMediaLoaded] = useState(false); // Tracks if all media (images, iframes) are fully loaded
  const [isSurveyPackageLoaded, setIsSurveyPackageLoaded] = useState(false); // Tracks if the survey package has been loaded into the DOM
  const isReadyToTransition = isMediaLoaded && minTimePassed && isBackgroundLoaded;
  const cardId = survey.welcomeCard.enabled ? `questionCard--1` : `questionCard-0`;

  // Function to check if all media elements (images and iframes) within the survey card are loaded
  const checkMediaLoaded = useCallback(() => {
    const cardElement = document.getElementById(cardId);
    const images = cardElement ? Array.from(cardElement.getElementsByTagName("img")) : [];
    const iframes = cardElement ? Array.from(cardElement.getElementsByTagName("iframe")) : [];

    const allImagesLoaded = images.every((img) => img.complete && img.naturalHeight !== 0);
    const allIframesLoaded = iframes.every((iframe) => {
      const contentWindow = iframe.contentWindow;
      return contentWindow && contentWindow.document.readyState === "complete";
    });

    if (allImagesLoaded && allIframesLoaded) {
      setIsMediaLoaded(true);
    }
  }, [cardId]);

  // Effect to monitor when the survey package is loaded and media elements are fully loaded
  useEffect(() => {
    if (!isSurveyPackageLoaded) return; // Exit early if the survey package is not yet loaded

    checkMediaLoaded(); // Initial check when the survey package is loaded

    // Add event listeners to detect when individual media elements finish loading
    const mediaElements = document.querySelectorAll(`#${cardId} img, #${cardId} iframe`);
    mediaElements.forEach((element) => element.addEventListener("load", checkMediaLoaded));

    return () => {
      // Cleanup event listeners when the component unmounts or dependencies change
      mediaElements.forEach((element) => element.removeEventListener("load", checkMediaLoaded));
    };
  }, [isSurveyPackageLoaded, checkMediaLoaded, cardId]);

  // Effect to handle the hiding of the animation once both media are loaded and the minimum time has passed
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

    // Observe the DOM for when the survey package (child elements) is added to the target node
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
        isReadyToTransition ? "bg-transparent" : "bg-white",
        isHidden && "hidden"
      )}>
      <div
        className={cn(
          "flex flex-col items-center space-y-4",
          isReadyToTransition ? "animate-surveyExit" : "animate-surveyLoading"
        )}>
        <Image src={Logo} alt="Logo" className={cn("w-32 transition-all duration-1000 md:w-40")} />
        <LoadingSpinner />
      </div>
    </div>
  );
};

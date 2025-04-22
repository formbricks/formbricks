import Logo from "@/images/powered-by-formbricks.svg";
import { cn } from "@/lib/cn";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

interface SurveyLoadingAnimationProps {
  isWelcomeCardEnabled: boolean;
  isBackgroundLoaded?: boolean;
  isBrandingEnabled: boolean;
}

export const SurveyLoadingAnimation = ({
  isWelcomeCardEnabled,
  isBackgroundLoaded = true,
  isBrandingEnabled,
}: SurveyLoadingAnimationProps) => {
  const [isHidden, setIsHidden] = useState(false);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const [isMediaLoaded, setIsMediaLoaded] = useState(false); // Tracks if all media are fully loaded
  const [isSurveyPackageLoaded, setIsSurveyPackageLoaded] = useState(false); // Tracks if the survey package has been loaded into the DOM
  const isReadyToTransition = isMediaLoaded && minTimePassed && isBackgroundLoaded;
  const cardId = isWelcomeCardEnabled ? `questionCard--1` : `questionCard-0`;

  // Function to check if all media elements (images and iframes) within the survey card are loaded
  const checkMediaLoaded = useCallback(() => {
    const cardElement = document.getElementById(cardId);
    const images = cardElement ? Array.from(cardElement.getElementsByTagName("img")) : [];

    const allImagesLoaded = images.every((img) => img.complete && img.naturalHeight !== 0);

    if (allImagesLoaded) {
      setIsMediaLoaded(true);
    }
  }, [cardId]);

  useEffect(() => {
    if (!isSurveyPackageLoaded) return;

    checkMediaLoaded();

    const mediaElements = document.querySelectorAll(`#${cardId} img, #${cardId} iframe`);
    const handleLoad = () => {
      checkMediaLoaded();
    };
    const handleError = () => {
      setIsMediaLoaded(true);
    };

    mediaElements.forEach((element) => {
      element.addEventListener("load", handleLoad);
      element.addEventListener("error", handleError);
    });

    // Set a 3-second timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsMediaLoaded(true);
    }, 3000);

    return () => {
      mediaElements.forEach((element) => {
        element.removeEventListener("load", handleLoad);
        element.removeEventListener("error", handleError);
      });
      clearTimeout(timeoutId);
    };
  }, [isSurveyPackageLoaded, checkMediaLoaded, cardId]);

  // Effect to handle the hiding of the animation once both media are loaded and the minimum time has passed
  useEffect(() => {
    if (isMediaLoaded && minTimePassed) {
      const hideTimer = setTimeout(() => {
        setIsHidden(true);
      }, 500);

      return () => {
        clearTimeout(hideTimer);
      };
    } else {
      setIsHidden(false);
    }
  }, [isMediaLoaded, minTimePassed]);

  useEffect(() => {
    // Ensure the animation is shown for at least 1.5 seconds
    const minTimeTimer = setTimeout(() => {
      setMinTimePassed(true);
    }, 500);

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
        "absolute inset-0 z-5000 flex items-center justify-center transition-colors duration-1000",
        isReadyToTransition ? "bg-transparent" : "bg-white",
        isHidden && "hidden"
      )}>
      <div
        className={cn(
          "flex flex-col items-center space-y-4",
          isReadyToTransition ? "animate-surveyExit" : "animate-surveyLoading"
        )}>
        {isBrandingEnabled && (
          <Image
            src={Logo as string}
            alt="Logo"
            className={cn("w-32 transition-all duration-1000 md:w-40")}
          />
        )}
        <LoadingSpinner />
      </div>
    </div>
  );
};

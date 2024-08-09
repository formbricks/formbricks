import Logo from "@/images/powered-by-formbricks.svg";
import Image from "next/image";
import { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { LoadingSpinner } from "@formbricks/ui/LoadingSpinner";

interface SurveyLoadingAnimationProps {
  isSurveyLoaded: boolean;
}

export const SurveyLoadingAnimation = ({ isSurveyLoaded }: SurveyLoadingAnimationProps) => {
  const [isHidden, setIsHidden] = useState(false);
  const [isEntranceComplete, setIsEntranceComplete] = useState(false);
  const [isAnimationBlocked, setIsAnimationBlocked] = useState(false);

  useEffect(() => {
    // Start the entrance animation
    const entranceTimer = setTimeout(() => {
      setIsEntranceComplete(true);
    }, 400);

    // Block exit animation until entrance animation is shown
    const blockExitTimer = setTimeout(() => {
      setIsAnimationBlocked(false);
    }, 400);

    return () => {
      clearTimeout(entranceTimer);
      clearTimeout(blockExitTimer);
    };
  }, []);

  useEffect(() => {
    if (isSurveyLoaded && !isAnimationBlocked) {
      const timer = setTimeout(() => {
        setIsHidden(true);
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      setIsHidden(false);
    }
  }, [isSurveyLoaded, isAnimationBlocked]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-[5000] flex items-center justify-center transition-colors duration-1000",
        isSurveyLoaded ? "bg-transparent" : "bg-white",
        isHidden && "hidden"
      )}>
      <div
        className={cn(
          "flex flex-col items-center space-y-4 transition-all duration-1000",
          isSurveyLoaded && !isAnimationBlocked ? "-translate-y-10 opacity-0" : "translate-y-0 opacity-100"
        )}>
        <Image
          src={Logo}
          alt="Logo"
          className={cn(
            "w-32 transition-all duration-1000 md:w-40",
            isEntranceComplete
              ? "translate-y-0 opacity-100" // Normal state after entrance animation
              : "translate-y-10 opacity-0", // Initial state for entrance animation
            isSurveyLoaded && !isAnimationBlocked ? "-translate-y-5 opacity-0" : ""
          )}
        />
        <div
          className={cn(
            "transition-all duration-1000",
            isEntranceComplete
              ? "opacity-100" // Normal state after entrance animation
              : "opacity-0", // Initial state for entrance animation
            isSurveyLoaded && !isAnimationBlocked ? "opacity-0 delay-200" : ""
          )}>
          <LoadingSpinner />
        </div>
      </div>
    </div>
  );
};

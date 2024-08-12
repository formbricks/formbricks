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
  const [minTimePassed, setMinTimePassed] = useState(false);

  useEffect(() => {
    // Ensure the animation is shown for at least 1.5 seconds
    const minTimeTimer = setTimeout(() => {
      setMinTimePassed(true);
    }, 1500);

    return () => clearTimeout(minTimeTimer);
  }, []);

  useEffect(() => {
    if (isSurveyLoaded && minTimePassed) {
      const timer = setTimeout(() => {
        setIsHidden(true);
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      setIsHidden(false);
    }
  }, [isSurveyLoaded, minTimePassed]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-[5000] flex items-center justify-center transition-colors duration-1000",
        isSurveyLoaded && minTimePassed ? "bg-transparent" : "bg-white",
        isHidden && "hidden"
      )}>
      <div
        className={cn(
          isSurveyLoaded && minTimePassed
            ? "animate-surveyExit flex flex-col items-center space-y-4"
            : "animate-surveyLoading flex flex-col items-center space-y-4"
        )}>
        <Image src={Logo} alt="Logo" className={cn("w-32 transition-all duration-1000 md:w-40")} />
        <LoadingSpinner />
      </div>
    </div>
  );
};

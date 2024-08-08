import Logo from "@/images/logo.png";
import Image from "next/image";
import React, { useEffect, useState } from "react";
import { cn } from "@formbricks/lib/cn";
import { LoadingSpinner } from "@formbricks/ui/LoadingSpinner";

interface SurveyLoadingAnimationProps {
  isSurveyLoaded: boolean;
}

export const SurveyLoadingAnimation = ({ isSurveyLoaded }: SurveyLoadingAnimationProps) => {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    if (isSurveyLoaded) {
      const timer = setTimeout(() => {
        setIsHidden(true);
      }, 1000);

      return () => clearTimeout(timer);
    } else {
      setIsHidden(false);
    }
  }, [isSurveyLoaded]);

  return (
    <div
      className={cn(
        "absolute inset-0 z-[5000] flex items-center justify-center bg-gradient-to-t from-teal-100 from-0% via-slate-100 via-100% transition-opacity duration-1000",
        isSurveyLoaded ? "opacity-0" : "opacity-100",
        isHidden && "hidden"
      )}>
      <div className="flex flex-col space-y-4">
        <Image src={Logo} alt="Logo" className="w-40 md:w-60" />
        <LoadingSpinner />
      </div>
    </div>
  );
};

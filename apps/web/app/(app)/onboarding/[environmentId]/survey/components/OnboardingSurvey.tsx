"use client";

import OnboardingSurveyBg from "@/images/onboarding-survey-bg.jpg";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { TProductConfigChannel } from "@formbricks/types/product";

interface OnboardingSurveyProps {
  environmentId: string;
  channel: TProductConfigChannel;
}

export const OnboardingSurvey = ({ environmentId, channel }: OnboardingSurveyProps) => {
  const [isIFrameVisible, setIsIFrameVisible] = useState(false);
  const [fadeout, setFadeout] = useState(false);
  const router = useRouter();

  const handleMessageEvent = (event: MessageEvent) => {
    if (event.data === "formbricksSurveyCompleted") {
      setFadeout(true); // Start fade-out
      setTimeout(() => {
        router.push(`/onboarding/${environmentId}/product/settings?channel=${channel}&industry=other`);
      }, 800); // Delay the navigation until fade-out completes
    }
  };

  useEffect(() => {
    if (isIFrameVisible) {
      window.addEventListener("message", handleMessageEvent, false);
      return () => {
        window.removeEventListener("message", handleMessageEvent, false);
      };
    }
  }, [isIFrameVisible]);

  return (
    <div
      className={`overflow relative flex h-[100vh] flex-col items-center justify-center ${fadeout ? "opacity-0 transition-opacity duration-1000" : "opacity-100"}`}>
      <Image src={OnboardingSurveyBg} className="absolute inset-0 h-full w-full" alt="OnboardingSurveyBg" />
      <div className="relative h-[60vh] w-[50vh] overflow-auto">
        <iframe
          onLoad={() => setIsIFrameVisible(true)}
          src="https://app.formbricks.com/s/clxcwr22p0cwlpvgekzdab2x5?embed=true"
          className="absolute left-0 top-0 h-full w-full overflow-visible border-0"></iframe>
      </div>
    </div>
  );
};

"use client";

import { CreateFirstSurvey } from "@/app/(app)/onboarding/components/link/CreateFirstSurvey";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface SurveyiFrameHandlingProps {
  environmentId: string;
  isFormbricksCloud: boolean;
  SET_CURRENT_STEP: (currentStep: number) => void;
}

export function SurveyiFrameHandling({
  environmentId,
  isFormbricksCloud,
  SET_CURRENT_STEP,
}: SurveyiFrameHandlingProps) {
  const [fade, setFade] = useState(false); // State to control fade-in and fade-out
  const router = useRouter();
  const [showOnboardingModal, setShowOnboardingModal] = useState(!isFormbricksCloud);
  const [iframeVisible, setIframeVisible] = useState(isFormbricksCloud);

  useEffect(() => {
    // Fade in when the component mounts
    setFade(true);
    const handleSurveyCompletion = () => {
      setTimeout(() => {
        setIframeVisible(false); // Hide the iframe after fade-out
      }, 1000);
      SET_CURRENT_STEP(5); // Update progress bar after survey complete
      setShowOnboardingModal(true);
      setFade(false); // Trigger fade-out
    };

    // Setup the event listener for the custom event to listen to survey completion
    window.addEventListener("SurveyCompleted", handleSurveyCompletion);

    // Cleanup function
    return () => {
      window.removeEventListener("SurveyCompleted", handleSurveyCompletion);
    };
  }, [router]);

  return (
    <div className="h-full w-full">
      {iframeVisible && (
        <iframe
          src="http://localhost:3000/s/clsui9a7x0000fbh5orp0g7c5"
          frameBorder="0"
          style={{
            inset: "0",
            position: "absolute",
            width: "100%",
            height: "100%",
            border: "0",
            zIndex: "40",
            transition: "opacity 1s ease",
            opacity: fade ? "1" : "0", // 1 for fade in, 0 for fade out
          }}></iframe>
      )}
      {showOnboardingModal && <CreateFirstSurvey environmentId={environmentId} />}
    </div>
  );
}

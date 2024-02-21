"use client";

import { OnboardingModal } from "@/app/(app)/onboarding/components/OnboardingModal";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface OnboardingLinkSurveyProps {
  environmentId: string;
  setHideOnboardingHeader: (hide: boolean) => void;
  isFormbricksCloud: boolean;
}

export function OnboardingLinkSurvey({
  environmentId,
  setHideOnboardingHeader,
  isFormbricksCloud,
}: OnboardingLinkSurveyProps) {
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
      setShowOnboardingModal(true);
      setHideOnboardingHeader(true);
      setFade(false); // Trigger fade-out
    };

    // Setup the event listener for the custom event to listen to survey completion
    window.addEventListener("SurveyCompleted", handleSurveyCompletion);

    // Cleanup function
    return () => {
      window.removeEventListener("SurveyCompleted", handleSurveyCompletion);
    };
  }, [router]);

  useEffect(() => {
    if (showOnboardingModal) {
      setHideOnboardingHeader(true);
    }
  }, [showOnboardingModal]);

  return (
    <div className="h-full w-full">
      {iframeVisible && (
        <iframe
          src="http://localhost:3000/s/clsvp9och001geqy0pueuq8ox"
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
      {showOnboardingModal && <OnboardingModal environmentId={environmentId} />}
    </div>
  );
}

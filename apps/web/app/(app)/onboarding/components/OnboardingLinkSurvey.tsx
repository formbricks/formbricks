"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { finishOnboardingAction } from "../actions";

export function OnboardingLinkSurvey() {
  const [fade, setFade] = useState(false); // State to control fade-in and fade-out
  const router = useRouter();

  useEffect(() => {
    // Fade in when the component mounts
    setFade(true);

    // Setup the event listener for the custom event to listen to survey completion
    const handleSurveyCompletion = () => {
      router.push("/");
      setFade(false); // Trigger fade-out
      localStorage.removeItem("CURRENT_STEP");
      finishOnboarding();
    };

    window.addEventListener("SurveyCompleted", handleSurveyCompletion);

    // Cleanup function
    return () => {
      window.removeEventListener("SurveyCompleted", handleSurveyCompletion);
    };
  }, [router]);

  const finishOnboarding = async () => {
    await finishOnboardingAction();
  };

  return (
    <div className="h-full w-full">
      <iframe
        src="http://localhost:3000/s/clslebywz005o8sojsaamispm"
        frameBorder="0"
        style={{
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%",
          border: "0",
          transition: "opacity 1s ease",
          opacity: fade ? "1" : "0", // 1 for fade in, 0 for fade out
        }}></iframe>
    </div>
  );
}

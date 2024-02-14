"use client";

import { useEffect } from "react";
import { toast } from "react-hot-toast";

import { updateUserAction } from "../actions";

export default function OnboardingLinkSurvey() {
  const finishOnboarding = async () => {
    try {
      const updatedProfile = { onboardingCompleted: true };
      await updateUserAction(updatedProfile);
    } catch (e) {
      toast.error("An error occured saving your settings.");
      console.error(e);
    }
  };

  useEffect(() => {
    finishOnboarding();
  }, []);

  return (
    <div className="h-full w-full">
      <iframe
        src="https://app.formbricks.com/s/cls34k9860jxexp6gogi4cppo"
        frameBorder="0"
        style={{
          position: "absolute",
          inset: "0",
          width: "100%",
          height: "100%",
          border: "0",
        }}></iframe>
    </div>
  );
}

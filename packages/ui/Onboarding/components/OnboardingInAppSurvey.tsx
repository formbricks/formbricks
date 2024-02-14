"use client";

import OnboardingHeader from "./OnboardingHeader";

export default function OnboardingInAppSurvey() {
  return (
    <div className="flex h-full w-full flex-col">
      <OnboardingHeader progress={50} />
      <iframe
        src="https://app.formbricks.com/s/clslmswhch2aepodw008fy1h2"
        frameBorder="0"
        style={{
          width: "100%",
          height: "100%",
          border: "0",
        }}></iframe>
    </div>
  );
}

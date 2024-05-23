// Filename: IntroSection.tsx
import React from "react";

type OnboardingTitleProps = {
  title: string;
  subtitle: string;
};

export const OnboardingTitle: React.FC<OnboardingTitleProps> = ({ title, subtitle }) => {
  return (
    <div className="space-y-4 text-center">
      <p className="text-4xl font-medium text-slate-800">{title}</p>
      <p className="text-sm text-slate-500">{subtitle}</p>
    </div>
  );
};

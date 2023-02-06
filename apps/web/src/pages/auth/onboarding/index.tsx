"use client";

import { useSearchParams } from "next/navigation";
import OnboardingSurvey from "@/components/auth/onboarding/OnboardingSurvey";
import LayoutAuth from "@/components/layout/LayoutAuth";

export default function Verify() {
  const searchParams = useSearchParams();
  return (
    <LayoutAuth title="Onboarding" onboarding>
      <OnboardingSurvey />
    </LayoutAuth>
  );
}

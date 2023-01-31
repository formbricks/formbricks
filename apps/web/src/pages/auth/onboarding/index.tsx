"use client";

import { useSearchParams } from "next/navigation";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import LayoutAuth from "@/components/layout/LayoutAuth";

export default function Verify() {
  const searchParams = useSearchParams();
  return (
    <LayoutAuth title="Onboarding" onboarding>
      <OnboardingForm />
    </LayoutAuth>
  );
}

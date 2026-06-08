import { SelectPlanCard } from "@/modules/ee/billing/components/select-plan-card";

interface SelectPlanOnboardingProps {
  organizationId: string;
  featureVariant: "control" | "variant_b";
  ctaVariant: "control" | "variant_b" | "variant_c" | "variant_d";
}

export const SelectPlanOnboarding = ({
  organizationId,
  featureVariant,
  ctaVariant,
}: Readonly<SelectPlanOnboardingProps>) => {
  const nextUrl = `/organizations/${organizationId}/workspaces/new/mode`;

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center">
      <SelectPlanCard
        nextUrl={nextUrl}
        organizationId={organizationId}
        featureVariant={featureVariant}
        ctaVariant={ctaVariant}
      />
    </div>
  );
};

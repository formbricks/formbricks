import { SelectPlanCard } from "@/modules/ee/billing/components/select-plan-card";
import { type TPlanVariant } from "@/modules/ee/billing/lib/select-plan-variants";

interface SelectPlanOnboardingProps {
  organizationId: string;
  variant: TPlanVariant;
}

export const SelectPlanOnboarding = ({ organizationId, variant }: Readonly<SelectPlanOnboardingProps>) => {
  const nextUrl = `/organizations/${organizationId}/workspaces/new/mode`;

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center">
      <SelectPlanCard nextUrl={nextUrl} organizationId={organizationId} variant={variant} />
    </div>
  );
};

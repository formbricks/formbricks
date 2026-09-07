import { SelectPlanCard } from "@/modules/ee/billing/components/select-plan-card";

interface SelectPlanOnboardingProps {
  organizationId: string;
}

export const SelectPlanOnboarding = ({ organizationId }: Readonly<SelectPlanOnboardingProps>) => {
  const nextUrl = `/organizations/${organizationId}/workspaces/new/survey`;

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center">
      <SelectPlanCard nextUrl={nextUrl} organizationId={organizationId} />
    </div>
  );
};

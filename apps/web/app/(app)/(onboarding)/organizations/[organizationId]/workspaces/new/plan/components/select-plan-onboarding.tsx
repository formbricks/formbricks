import { SelectPlanCard } from "@/modules/ee/billing/components/select-plan-card";
import { Header } from "@/modules/ui/components/header";

interface SelectPlanOnboardingProps {
  organizationId: string;
}

export const SelectPlanOnboarding = ({ organizationId }: SelectPlanOnboardingProps) => {
  const nextUrl = `/organizations/${organizationId}/workspaces/new/mode`;

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-8">
      <Header
        title="Ship professional, unbranded surveys today!"
        subtitle="No credit card required, no strings attached."
      />
      <SelectPlanCard nextUrl={nextUrl} />
    </div>
  );
};

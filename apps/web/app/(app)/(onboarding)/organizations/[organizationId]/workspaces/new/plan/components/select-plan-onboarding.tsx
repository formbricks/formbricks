import { getTranslate } from "@/lingodotdev/server";
import { SelectPlanCard } from "@/modules/ee/billing/components/select-plan-card";
import { Header } from "@/modules/ui/components/header";

interface SelectPlanOnboardingProps {
  organizationId: string;
}

export const SelectPlanOnboarding = async ({ organizationId }: SelectPlanOnboardingProps) => {
  const t = await getTranslate();
  const nextUrl = `/organizations/${organizationId}/workspaces/new/mode`;

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-8">
      <Header
        title={t("environments.settings.billing.select_plan_header_title")}
        subtitle={t("environments.settings.billing.select_plan_header_subtitle")}
      />
      <SelectPlanCard nextUrl={nextUrl} organizationId={organizationId} />
    </div>
  );
};

import { getTranslate } from "@/lingodotdev/server";
import { SelectPlanCard } from "@/modules/ee/billing/components/select-plan-card";
import { type TPlanVariant } from "@/modules/ee/billing/lib/select-plan-variants";
import { Header } from "@/modules/ui/components/header";

interface SelectPlanOnboardingProps {
  organizationId: string;
  variant?: TPlanVariant;
}

export const SelectPlanOnboarding = async ({ organizationId, variant = "a" }: SelectPlanOnboardingProps) => {
  const t = await getTranslate();
  const nextUrl = `/organizations/${organizationId}/workspaces/new/mode`;

  const isVariantB = variant === "b";

  const headerTitle = isVariantB
    ? t("environments.settings.billing.select_plan_variant_b_header_title")
    : t("environments.settings.billing.select_plan_header_title");

  const headerSubtitle = isVariantB
    ? t("environments.settings.billing.select_plan_variant_b_header_subtitle")
    : t("environments.settings.billing.select_plan_header_subtitle");

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-8">
      <Header title={headerTitle} subtitle={headerSubtitle} />
      <SelectPlanCard nextUrl={nextUrl} organizationId={organizationId} variant={variant} />
    </div>
  );
};

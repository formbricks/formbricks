import { getTranslate } from "@/lingodotdev/server";
import { SelectPlanCard } from "@/modules/ee/billing/components/select-plan-card";
import { type TPlanVariant } from "@/modules/ee/billing/lib/select-plan-variants";
import { Header } from "@/modules/ui/components/header";

interface SelectPlanOnboardingProps {
  organizationId: string;
  variant?: TPlanVariant;
}

export const SelectPlanOnboarding = async ({
  organizationId,
  variant = "control",
}: SelectPlanOnboardingProps) => {
  const t = await getTranslate();
  const nextUrl = `/organizations/${organizationId}/workspaces/new/mode`;

  const isGiftedPro = variant === "gifted_pro";

  const headerTitle = isGiftedPro
    ? t("workspace.settings.billing.select_plan_variant_b_header_title")
    : t("workspace.settings.billing.select_plan_header_title");

  const headerSubtitle = isGiftedPro
    ? t("workspace.settings.billing.select_plan_variant_b_header_subtitle")
    : t("workspace.settings.billing.select_plan_header_subtitle");

  return (
    <div className="flex min-h-full min-w-full flex-col items-center justify-center space-y-8">
      <Header title={headerTitle} subtitle={headerSubtitle} />
      <SelectPlanCard nextUrl={nextUrl} organizationId={organizationId} variant={variant} />
    </div>
  );
};

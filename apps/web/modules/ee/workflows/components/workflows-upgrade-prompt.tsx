import { ENTERPRISE_LICENSE_REQUEST_FORM_URL, IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { UpgradePrompt } from "@/modules/ui/components/upgrade-prompt";

interface WorkflowsUpgradePromptProps {
  organizationId: string;
}

/**
 * Centered upsell rendered by the workflows route layouts when the organization lacks the
 * workflows entitlement (Cloud Scale plan / self-hosted EE license). Mirrors the dashboards
 * upgrade prompt: upgrade (Cloud) or request a trial license (self-hosted), plus docs.
 */
export const WorkflowsUpgradePrompt = async ({ organizationId }: Readonly<WorkflowsUpgradePromptProps>) => {
  const t = await getTranslate();

  return (
    <div className="flex items-center justify-center">
      <UpgradePrompt
        title={t("workspace.workflows.upgrade_prompt_title")}
        description={t("workspace.workflows.upgrade_prompt_description")}
        feature="workflows"
        buttons={[
          {
            text: IS_FORMBRICKS_CLOUD ? t("common.upgrade_plan") : t("common.request_trial_license"),
            href: IS_FORMBRICKS_CLOUD
              ? `/organizations/${organizationId}/settings/billing`
              : ENTERPRISE_LICENSE_REQUEST_FORM_URL,
          },
          {
            text: t("common.learn_more"),
            href: "https://formbricks.com/docs/workflows/overview",
          },
        ]}
      />
    </div>
  );
};

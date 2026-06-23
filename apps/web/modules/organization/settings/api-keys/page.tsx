import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { DEFAULT_LOCALE } from "@/lib/constants";
import { getUserLocale } from "@/lib/user/service";
import { getTranslate } from "@/lingodotdev/server";
import { getOrganizationAuth } from "@/modules/organization/lib/utils";
import { getWorkspacesByOrganizationId } from "@/modules/organization/settings/api-keys/lib/workspaces";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { ApiKeyList } from "./components/api-key-list";

export const APIKeysPage = async (props: { params: Promise<{ organizationId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { currentUserMembership, organization, session } = await getOrganizationAuth(params.organizationId);

  const [workspaces, locale] = await Promise.all([
    getWorkspacesByOrganizationId(organization.id),
    getUserLocale(session.user.id),
  ]);

  const canAccessApiKeys = currentUserMembership.role === "owner" || currentUserMembership.role === "manager";

  if (!canAccessApiKeys) throw new Error(t("common.not_authorized"));

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.api_keys")} />
      <SettingsCard
        title={t("common.api_keys")}
        description={t("workspace.settings.api_keys.api_keys_description")}>
        <ApiKeyList
          organizationId={organization.id}
          locale={locale ?? DEFAULT_LOCALE}
          isReadOnly={!canAccessApiKeys}
          workspaces={workspaces}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};

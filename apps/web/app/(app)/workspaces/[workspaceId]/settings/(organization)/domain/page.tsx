import { notFound } from "next/navigation";
import { AuthenticationError } from "@formbricks/types/errors";
import { OrganizationSettingsNavbar } from "@/app/(app)/workspaces/[workspaceId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { PrettyUrlsTable } from "@/app/(app)/workspaces/[workspaceId]/settings/(organization)/domain/components/pretty-urls-table";
import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { IS_FORMBRICKS_CLOUD, IS_STORAGE_CONFIGURED } from "@/lib/constants";
import { getTranslate } from "@/lingodotdev/server";
import { getWhiteLabelPermission } from "@/modules/ee/license-check/lib/utils";
import { FaviconCustomizationSettings } from "@/modules/ee/whitelabel/favicon-customization/components/favicon-customization-settings";
import { getWorkspaceAuth } from "@/modules/environments/lib/utils";
import { getSurveysWithSlugsByOrganizationId } from "@/modules/survey/lib/slug";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Page = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  if (IS_FORMBRICKS_CLOUD) {
    return notFound();
  }

  const { session, currentUserMembership, organization, isOwner, isManager } = await getWorkspaceAuth(
    params.workspaceId
  );

  if (!session) {
    throw new AuthenticationError(t("common.not_authenticated"));
  }

  const hasWhiteLabelPermission = await getWhiteLabelPermission(organization.id);
  const isOwnerOrManager = isManager || isOwner;

  const surveys = await getSurveysWithSlugsByOrganizationId(organization.id);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="domain"
        />
      </PageHeader>

      {!IS_STORAGE_CONFIGURED && (
        <div className="max-w-4xl">
          <Alert variant="warning">
            <AlertDescription>{t("common.storage_not_configured")}</AlertDescription>
          </Alert>
        </div>
      )}

      <FaviconCustomizationSettings
        organization={organization}
        hasWhiteLabelPermission={hasWhiteLabelPermission}
        environmentId={params.workspaceId}
        isReadOnly={!isOwnerOrManager}
        isStorageConfigured={IS_STORAGE_CONFIGURED}
      />

      <SettingsCard
        title={t("environments.settings.domain.title")}
        description={t("environments.settings.domain.description")}>
        <PrettyUrlsTable surveys={surveys} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Page;

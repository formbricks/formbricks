import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { AIToggle } from "@/app/(app)/environments/[environmentId]/settings/(organization)/general/components/AIToggle";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SettingsId } from "@/modules/ui/components/settings-id";
import { getTranslate } from "@/tolgee/server";
import { IS_FORMBRICKS_CLOUD } from "@formbricks/lib/constants";
import { SettingsCard } from "../../components/SettingsCard";
import { EditOrganizationNameForm } from "./components/EditOrganizationNameForm";

const Page = async (props: { params: Promise<{ environmentId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { session, currentUserMembership, organization, isOwner, isManager } = await getEnvironmentAuth(
    params.environmentId
  );

  const isOwnerOrManager = isManager || isOwner;

  const isOrganizationAIReady = false;

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership?.role}
          activeId="general"
        />
      </PageHeader>
      <SettingsCard
        title={t("environments.settings.general.organization_name")}
        description={t("environments.settings.general.organization_name_description")}>
        <EditOrganizationNameForm
          organization={organization}
          environmentId={params.environmentId}
          membershipRole={currentUserMembership?.role}
        />
      </SettingsCard>
      {isOrganizationAIReady && (
        <SettingsCard
          title={t("environments.settings.general.formbricks_ai")}
          description={t("environments.settings.general.formbricks_ai_description")}>
          <AIToggle
            environmentId={params.environmentId}
            organization={organization}
            isOwnerOrManager={isOwnerOrManager}
          />
        </SettingsCard>
      )}
      <SettingsId title={t("common.organization_id")} id={organization.id}></SettingsId>
    </PageContentWrapper>
  );
};

export default Page;

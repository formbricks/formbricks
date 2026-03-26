import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { IS_FORMBRICKS_CLOUD } from "@/lib/constants";
import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { FeedbackRecordDirectoryView } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-view";
import { getEnvironmentAuth } from "@/modules/environments/lib/utils";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

export const FeedbackRecordDirectoriesPage = async (props: {
  params: Promise<{ environmentId: string }>;
}) => {
  const params = await props.params;
  const t = await getTranslate();

  const { currentUserMembership, organization } = await getEnvironmentAuth(params.environmentId);

  const { isOwner, isManager } = getAccessFlags(currentUserMembership.role);

  if (!isOwner && !isManager) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
          <OrganizationSettingsNavbar
            environmentId={params.environmentId}
            isFormbricksCloud={IS_FORMBRICKS_CLOUD}
            membershipRole={currentUserMembership.role}
            activeId="feedback-record-directories"
          />
        </PageHeader>
        <p className="text-sm text-slate-500">
          {t("environments.settings.feedback_record_directories.no_access")}
        </p>
      </PageContentWrapper>
    );
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar
          environmentId={params.environmentId}
          isFormbricksCloud={IS_FORMBRICKS_CLOUD}
          membershipRole={currentUserMembership.role}
          activeId="feedback-record-directories"
        />
      </PageHeader>
      <FeedbackRecordDirectoryView
        organizationId={organization.id}
        membershipRole={currentUserMembership.role}
      />
    </PageContentWrapper>
  );
};

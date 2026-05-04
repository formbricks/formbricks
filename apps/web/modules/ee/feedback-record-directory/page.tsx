import { getAccessFlags } from "@/lib/membership/utils";
import { getTranslate } from "@/lingodotdev/server";
import { FeedbackRecordDirectoryView } from "@/modules/ee/feedback-record-directory/components/feedback-record-directory-view";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";

export const FeedbackRecordDirectoriesPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { currentUserMembership, organization } = await getWorkspaceAuth(params.workspaceId);

  const { isOwner, isManager } = getAccessFlags(currentUserMembership.role);

  if (!isOwner && !isManager) {
    return (
      <PageContentWrapper>
        <PageHeader pageTitle={t("workspace.settings.general.organization_settings")} />
        <p className="text-sm text-slate-500">
          {t("workspace.settings.feedback_record_directories.no_access")}
        </p>
      </PageContentWrapper>
    );
  }

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("workspace.settings.general.organization_settings")} />
      <FeedbackRecordDirectoryView
        organizationId={organization.id}
        membershipRole={currentUserMembership.role}
      />
    </PageContentWrapper>
  );
};

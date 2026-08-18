import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { EditTagsWrapper } from "./components/edit-tags-wrapper";

export const TagsPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  // The tags themselves are fetched client-side through `/api/v3/tags`, so this page only resolves the
  // permission that decides whether the actions column renders.
  const { isReadOnly } = await getWorkspaceAuth(params.workspaceId);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.tags")} />
      <SettingsCard
        title={t("workspace.tags.manage_tags")}
        description={t("workspace.tags.manage_tags_description")}
        bodyVariant="flush">
        <EditTagsWrapper workspaceId={params.workspaceId} isReadOnly={isReadOnly} />
      </SettingsCard>
    </PageContentWrapper>
  );
};

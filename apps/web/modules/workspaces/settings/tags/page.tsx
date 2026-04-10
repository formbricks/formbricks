import { SettingsCard } from "@/app/(app)/workspaces/[workspaceId]/settings/components/SettingsCard";
import { getTagsByWorkspaceId } from "@/lib/tag/service";
import { getTagsOnResponsesCount } from "@/lib/tagOnResponse/service";
import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { WorkspaceConfigNavigation } from "@/modules/workspaces/settings/components/workspace-config-navigation";
import { EditTagsWrapper } from "./components/edit-tags-wrapper";

export const TagsPage = async (props: { params: Promise<{ workspaceId: string }> }) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly } = await getWorkspaceAuth(params.workspaceId);

  const [tags, environmentTagsCount] = await Promise.all([
    getTagsByWorkspaceId(params.workspaceId),
    getTagsOnResponsesCount(params.workspaceId),
  ]);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.workspace_configuration")}>
        <WorkspaceConfigNavigation activeId="tags" />
      </PageHeader>
      <SettingsCard
        title={t("workspace.tags.manage_tags")}
        description={t("workspace.tags.manage_tags_description")}>
        <EditTagsWrapper
          environmentTags={tags}
          environmentTagsCount={environmentTagsCount}
          isReadOnly={isReadOnly}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};

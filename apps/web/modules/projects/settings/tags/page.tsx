import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { getEnvironmentAuth } from "@/modules/environments/lib/fetcher";
import { ProjectConfigNavigation } from "@/modules/projects/settings/components/project-config-navigation";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";
import { getTagsByEnvironmentId } from "@formbricks/lib/tag/service";
import { getTagsOnResponsesCount } from "@formbricks/lib/tagOnResponse/service";
import { EditTagsWrapper } from "./components/edit-tags-wrapper";

export const TagsPage = async (props) => {
  const params = await props.params;
  const t = await getTranslate();

  const { isReadOnly, environment } = await getEnvironmentAuth(params.environmentId);

  const [tags, environmentTagsCount] = await Promise.all([
    getTagsByEnvironmentId(params.environmentId),
    getTagsOnResponsesCount(params.environmentId),
  ]);

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.project_configuration")}>
        <ProjectConfigNavigation environmentId={params.environmentId} activeId="tags" />
      </PageHeader>
      <SettingsCard
        title={t("environments.project.tags.manage_tags")}
        description={t("environments.project.tags.manage_tags_description")}>
        <EditTagsWrapper
          environment={environment}
          environmentTags={tags}
          environmentTagsCount={environmentTagsCount}
          isReadOnly={isReadOnly}
        />
      </SettingsCard>
    </PageContentWrapper>
  );
};

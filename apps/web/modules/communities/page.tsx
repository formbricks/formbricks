import { CommunitiesClient } from "@/modules/communities/components/communities/communities-client";
import { getTranslate } from "@/tolgee/server";
import { getEnvironment } from "@formbricks/lib/environment/service";

interface CommunitiesPageProps {
  params: Promise<{
    environmentId: string;
  }>;
}

export const CommunitiesPage = async (props: CommunitiesPageProps) => {
  const params = await props.params;
  const t = await getTranslate();
  const environment = await getEnvironment(params.environmentId);

  if (!environment) {
    throw new Error(t("common.environment_not_found"));
  }

  return <CommunitiesClient environmentId={environment.id} translatedTitle={t("common.communities")} />;
};

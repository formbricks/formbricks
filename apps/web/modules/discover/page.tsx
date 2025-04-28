import Engagements from "@/modules/discover/components/engagements";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

export const DiscoverPage = async () => {
  const t = await getTranslate();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.discover")} />
      <Engagements />
    </PageContentWrapper>
  );
};

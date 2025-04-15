import AvailableSurveys from "@/modules/activity/components/AvailableSurveys";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { getTranslate } from "@/tolgee/server";

export const ActivityPage = async () => {
  const t = await getTranslate();

  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.activity")} />
      <AvailableSurveys />
    </PageContentWrapper>
  );
};

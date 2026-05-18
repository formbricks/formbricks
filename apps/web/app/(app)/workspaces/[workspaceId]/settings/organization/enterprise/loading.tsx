import { getTranslate } from "@/lingodotdev/server";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";

const Loading = async () => {
  const t = await getTranslate();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.enterprise_license")} />
      <div className="my-8 h-64 animate-pulse rounded-xl bg-slate-200"></div>
      <div className="my-8 h-96 animate-pulse rounded-md bg-slate-200"></div>
    </PageContentWrapper>
  );
};

export default Loading;

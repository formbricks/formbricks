import { SurveyLoading } from "@/app/(app)/environments/[environmentId]/surveys/components/SurveyLoading";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslations } from "next-intl";

const Loading = () => {
  const t = useTranslations();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.surveys")} />
      <div className="flex items-center justify-between">
        <div className="flex h-9 animate-pulse gap-2">
          <div className="w-48 rounded-md bg-slate-300"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-24 rounded-md bg-slate-300"></div>
          ))}
        </div>
        <div className="flex h-9 animate-pulse gap-2">
          <div className="w-9 rounded-md bg-slate-300"></div>
          <div className="w-9 rounded-md bg-slate-300"></div>
          <div className="w-36 rounded-md bg-slate-300"></div>
        </div>
      </div>
      <SurveyLoading />
    </PageContentWrapper>
  );
};

export default Loading;

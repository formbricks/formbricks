import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { getTranslations } from "next-intl/server";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Loading = async () => {
  const t = await getTranslations();
  return (
    <>
      <PageContentWrapper>
        <PageHeader pageTitle={t("common.people")}>
          <PersonSecondaryNavigation activeId="people" loading />
        </PageHeader>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid h-12 grid-cols-7 content-center border-b text-left text-sm font-semibold text-slate-900">
            <div className="col-span-3 pl-6">{t("common.user")}</div>
            <div className="col-span-2 text-center">{t("common.user_id")}</div>
            <div className="col-span-2 text-center">{t("common.email")}</div>
          </div>
          <div className="w-full">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="m-2 grid h-16 grid-cols-7 content-center rounded-lg transition-colors ease-in-out hover:bg-slate-100">
                <div className="col-span-3 flex items-center pl-6 text-sm">
                  <div className="flex items-center">
                    <div className="ph-no-capture h-10 w-10 flex-shrink-0 animate-pulse rounded-full bg-slate-200"></div>{" "}
                    <div className="ml-4">
                      <div className="ph-no-capture h-4 w-28 animate-pulse rounded-full bg-slate-200 font-medium text-slate-900"></div>
                    </div>{" "}
                  </div>
                </div>
                <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
                  <div className="ph-no-capture m-12 h-4 animate-pulse rounded-full bg-slate-200 text-slate-900"></div>
                </div>
                <div className="col-span-2 my-auto whitespace-nowrap text-center text-sm text-slate-500">
                  <div className="ph-no-capture m-12 h-4 animate-pulse rounded-full bg-slate-200 text-slate-900"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContentWrapper>
    </>
  );
};

export default Loading;

"use client";

import { OrganizationSettingsNavbar } from "@/app/(app)/environments/[environmentId]/settings/(organization)/components/OrganizationSettingsNavbar";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslate } from "@tolgee/react";

const LoadingCard = () => {
  const { t } = useTranslate();
  return (
    <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 shadow-sm">
      <div className="grid content-center border-b border-slate-200 px-4 pb-4 text-left text-slate-900">
        <h3 className="h-6 w-full max-w-56 animate-pulse rounded-lg bg-slate-100 text-lg font-medium leading-6"></h3>
        <p className="mt-3 h-4 w-full max-w-80 animate-pulse rounded-lg bg-slate-100 text-sm text-slate-500"></p>
      </div>
      <div className="w-full">
        <div className="rounded-lg px-4 pt-4">
          <div className="rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-10 content-center rounded-t-lg bg-slate-100 px-6 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-4 sm:col-span-2">{t("common.label")}</div>
              <div className="col-span-4 hidden sm:col-span-5 sm:block">
                {t("environments.project.api_keys.api_key")}
              </div>
              <div className="col-span-4 sm:col-span-2">{t("common.created_at")}</div>
            </div>
            <div className="px-6">
              <div className="my-4 h-5 w-full animate-pulse rounded-full bg-slate-200"></div>
            </div>
          </div>
          <div className="flex justify-start">
            <div className="mt-4 flex h-8 w-44 animate-pulse flex-col items-center justify-center rounded-md bg-black text-sm text-white">
              {t("common.loading")}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Loading = () => {
  const { t } = useTranslate();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("environments.settings.general.organization_settings")}>
        <OrganizationSettingsNavbar isFormbricksCloud={true} activeId="api-keys" loading />
      </PageHeader>
      <div className="mt-4 flex max-w-4xl animate-pulse items-center space-y-4 rounded-lg border bg-blue-50 p-6 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base"></div>
      <LoadingCard />
    </PageContentWrapper>
  );
};

export default Loading;

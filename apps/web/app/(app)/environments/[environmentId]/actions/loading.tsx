"use client";

import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { useTranslate } from "@tolgee/react";

const Loading = () => {
  const { t } = useTranslate();
  return (
    <>
      <PageContentWrapper>
        <PageHeader pageTitle={t("common.actions")} />
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid h-12 grid-cols-6 content-center border-b border-slate-200 text-left text-sm font-semibold text-slate-900">
            <span className="sr-only">{t("common.edit")}</span>
            <div className="col-span-4 pl-6">{t("environments.actions.user_actions")}</div>
            <div className="col-span-2 text-center">{t("common.created")}</div>
          </div>
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="m-2 grid h-16 grid-cols-6 content-center rounded-lg transition-colors ease-in-out hover:bg-slate-100">
              <div className="col-span-4 flex items-center pl-6 text-sm">
                <div className="flex items-center">
                  <div className="h-6 w-6 flex-shrink-0 animate-pulse rounded-full bg-slate-200 text-slate-500" />
                  <div className="ml-4 text-left">
                    <div className="font-medium text-slate-900">
                      <div className="mt-0 h-4 w-48 animate-pulse rounded-full bg-slate-200"></div>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      <div className="h-2 w-24 animate-pulse rounded-full bg-slate-200"></div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-2 my-auto flex justify-center text-center text-sm whitespace-nowrap text-slate-500">
                <div className="h-4 w-28 animate-pulse rounded-full bg-slate-200"></div>
              </div>
            </div>
          ))}
        </div>
      </PageContentWrapper>
    </>
  );
};
export default Loading;

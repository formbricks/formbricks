"use client";

import { Button } from "@/modules/ui/components/button";
import { GoBackButton } from "@/modules/ui/components/go-back-button";
import { useTranslate } from "@tolgee/react";

const Loading = () => {
  const { t } = useTranslate();
  return (
    <div className="mt-6 p-6">
      <GoBackButton />
      <div className="mb-6 text-right">
        <Button className="pointer-events-none animate-pulse cursor-not-allowed select-none bg-slate-200">
          {t("environments.integrations.google_sheets.link_new_sheet")}
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-12 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-4 text-center">{t("common.survey")}</div>
          <div className="col-span-4 text-center">
            {t("environments.integrations.google_sheets.google_sheet_name")}
          </div>
          <div className="col-span-2 text-center">{t("common.questions")}</div>
          <div className="col-span-2 text-center">{t("common.updated_at")}</div>
        </div>
        <div className="grid-cols-7">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="mt-2 grid h-16 grid-cols-12 content-center rounded-lg hover:bg-slate-100">
              <div className="col-span-3 flex items-center pl-6 text-sm">
                <div className="text-left">
                  <div className="font-medium text-slate-900">
                    <div className="mt-0 h-4 w-48 animate-pulse rounded-full bg-slate-200"></div>
                  </div>
                </div>
              </div>
              <div className="col-span-1 my-auto flex items-center justify-center text-center text-sm text-slate-500">
                <div className="font-medium text-slate-500">
                  <div className="mt-0 h-4 w-24 animate-pulse rounded-full bg-slate-200"></div>
                </div>
              </div>
              <div className="col-span-4 my-auto flex items-center justify-center text-center text-sm text-slate-500">
                <div className="font-medium text-slate-500">
                  <div className="mt-0 h-4 w-36 animate-pulse rounded-full bg-slate-200"></div>
                </div>
              </div>
              <div className="col-span-2 my-auto flex items-center justify-center text-center text-sm text-slate-500">
                <div className="font-medium text-slate-500">
                  <div className="mt-0 h-4 w-24 animate-pulse rounded-full bg-slate-200"></div>
                </div>
              </div>
              <div className="col-span-2 my-auto flex items-center justify-center whitespace-nowrap text-center text-sm text-slate-500">
                <div className="h-4 w-16 animate-pulse rounded-full bg-slate-200"></div>
              </div>
              <div className="text-center"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Loading;

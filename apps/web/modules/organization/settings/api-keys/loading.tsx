"use client";

import { useTranslation } from "react-i18next";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import { SettingsTableSkeleton } from "@/modules/ui/components/settings-table";
import { getApiKeyColumns } from "./components/edit-api-keys";

const LoadingCard = () => {
  const { t } = useTranslation();
  return (
    <div className="w-full max-w-4xl overflow-hidden rounded-xl border border-slate-200 bg-white py-4 shadow-xs">
      <div className="grid content-center border-b border-slate-200 px-4 pb-4 text-left text-slate-900">
        <h3 className="h-6 w-full max-w-56 animate-pulse rounded-lg bg-slate-100 text-lg leading-6 font-medium">
          <span className="sr-only">{t("common.loading")}</span>
        </h3>
        <p className="mt-3 h-4 w-full max-w-80 animate-pulse rounded-lg bg-slate-100 text-sm text-slate-500">
          <span className="sr-only">{t("common.loading")}</span>
        </p>
      </div>
      {/* `-mb-4` mirrors `SettingsCard`'s `bodyVariant="flush"`, so the skeleton table meets the card's
          bottom edge the way the real one does. */}
      <div className="-mb-4">
        <div className="mb-4 flex justify-end px-4 pt-4">
          <div className="flex h-8 w-32 animate-pulse items-center justify-center rounded-md bg-slate-200">
            <span className="sr-only">{t("common.loading")}</span>
          </div>
        </div>
        {/*
          The columns come from the table's own factory rather than being hand-rolled here. This skeleton
          previously duplicated the header markup and had drifted to three columns against the table's
          four — the exact failure the shared factory makes unrepresentable.

          `locale` and `onDelete` are never reached: the skeleton renders each column's header and a
          placeholder bar, and never calls `cell`.
        */}
        <SettingsTableSkeleton
          columns={getApiKeyColumns({
            t,
            locale: "en-US",
            isReadOnly: false,
            onDelete: () => undefined,
          })}
        />
      </div>
    </div>
  );
};

const Loading = () => {
  const { t } = useTranslation();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle={t("common.api_keys")} />
      <div className="mt-4 flex max-w-4xl animate-pulse items-center gap-y-4 rounded-lg border bg-blue-50 p-6 text-sm text-blue-900 shadow-xs md:gap-y-0 md:text-base"></div>
      <LoadingCard />
    </PageContentWrapper>
  );
};

export default Loading;

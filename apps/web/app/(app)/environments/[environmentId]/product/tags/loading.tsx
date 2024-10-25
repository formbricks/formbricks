"use client";

import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { useTranslations } from "next-intl";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Loading = () => {
  const t = useTranslations();
  return (
    <PageContentWrapper>
      <PageHeader pageTitle="common.configuration">
        <ProductConfigNavigation activeId="tags" />
      </PageHeader>
      <SettingsCard
        title="environments.product.tags.manage_tags"
        description="environments.product.tags.manage_tags_description">
        <div className="w-full">
          <div className="grid grid-cols-4 content-center rounded-lg bg-white text-left text-sm font-semibold text-slate-900">
            <div className="col-span-2">{t("environments.product.tags.tag")}</div>
            <div className="col-span-1 text-center">{t("environments.product.tags.count")}</div>
            <div className="col-span-1 flex justify-center text-center">{t("common.actions")}</div>
          </div>
          <div className="w-full">
            {[...Array(3)].map((_, idx) => (
              <div key={idx} className="grid h-16 w-full grid-cols-4 content-center">
                <div className="col-span-2 h-10 animate-pulse rounded-md bg-slate-200" />

                <div className="flex items-center justify-center">
                  <div className="h-5 w-5 animate-pulse rounded-md bg-slate-200" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-1/2 animate-pulse rounded-md bg-slate-200" />
                  <div className="h-8 w-1/2 animate-pulse rounded-md bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Loading;

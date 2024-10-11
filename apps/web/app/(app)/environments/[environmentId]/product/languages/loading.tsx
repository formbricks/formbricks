"use client";

import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { LanguageLabels } from "@formbricks/ee/multi-language/components/language-labels";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Loading = () => {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation activeId="languages" loading />
      </PageHeader>
      <SettingsCard
        title="Multi-language surveys"
        description="Add languages to create multi-language surveys.">
        <div className="flex flex-col space-y-4">
          <LanguageLabels />
          {[...Array(3)].map((_, idx) => (
            <div key={idx} className="my-3 grid h-10 grid-cols-4 gap-4">
              <div className="h-full animate-pulse rounded-md bg-slate-200" />
              <div className="h-full animate-pulse rounded-md bg-slate-200" />
              <div className="h-full animate-pulse rounded-md bg-slate-200" />
            </div>
          ))}
        </div>
      </SettingsCard>
    </PageContentWrapper>
  );
};

export default Loading;

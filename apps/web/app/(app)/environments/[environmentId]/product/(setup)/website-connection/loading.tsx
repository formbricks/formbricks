"use client";

import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { SettingsCard } from "@/app/(app)/environments/[environmentId]/settings/components/SettingsCard";
import { cn } from "@formbricks/lib/cn";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const LoadingCard = ({ title, description, skeletonLines }) => {
  return (
    <SettingsCard title={title} description={description}>
      <div className="w-full">
        <div className="rounded-lg px-4">
          {skeletonLines.map((line, index) => (
            <div key={index} className="mt-4">
              <div
                className={cn(
                  "flex animate-pulse flex-col items-center justify-center space-y-2 rounded-lg bg-slate-200 py-6 text-center",
                  line.classes
                )}></div>
            </div>
          ))}
        </div>
      </div>
    </SettingsCard>
  );
};

const Loading = () => {
  const cards = [
    {
      title: "Website Connection Status",
      description: "Check if your website is successfully connected with Formbricks. Reload page to recheck.",
      skeletonLines: [{ classes: " h-44 max-w-full rounded-md" }],
    },
    {
      title: "How to setup",
      description: "Follow these steps to setup the Formbricks widget within your website.",
      skeletonLines: [
        { classes: "h-6 w-24 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
        { classes: "h-6 w-24 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
      ],
    },
    {
      title: "Your EnvironmentId",
      description: "This id uniquely identifies this Formbricks environment.",
      skeletonLines: [{ classes: "h-6 w-4/6 rounded-full" }],
    },
  ];

  return (
    <div>
      <PageContentWrapper>
        <PageHeader pageTitle="Configuration">
          <ProductConfigNavigation activeId="website-connection" loading />
        </PageHeader>
        <div className="mt-4 flex max-w-4xl animate-pulse items-center space-y-4 rounded-lg border bg-blue-50 p-6 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base"></div>
        {cards.map((card, index) => (
          <LoadingCard key={index} {...card} />
        ))}
      </PageContentWrapper>
    </div>
  );
};

export default Loading;

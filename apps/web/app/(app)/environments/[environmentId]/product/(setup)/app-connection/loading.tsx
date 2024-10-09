"use client";

import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Loading = () => {
  const cards = [
    {
      title: "App Connection Status",
      description: "Check if your app is successfully connected with Formbricks. Reload page to recheck.",
      skeletonLines: [{ classes: " h-44 max-w-full rounded-lg" }],
    },
    {
      title: "How to setup",
      description: "Follow these steps to setup the Formbricks widget within your app.",
      skeletonLines: [
        { classes: "h-12 w-24 rounded-lg" },
        { classes: "h-10 w-60 rounded-lg" },
        { classes: "h-10 w-60 rounded-lg" },
        { classes: "h-12 w-24 rounded-lg" },
        { classes: "h-10 w-60 rounded-lg" },
        { classes: "h-10 w-60 rounded-lg" },
      ],
    },
    {
      title: "Your EnvironmentId",
      description: "This id uniquely identifies this Formbricks environment.",
      skeletonLines: [{ classes: "h-12 w-4/6 rounded-lg" }],
    },
  ];

  return (
    <div>
      <PageContentWrapper>
        <PageHeader pageTitle="Configuration">
          <ProductConfigNavigation activeId="app-connection" loading />
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

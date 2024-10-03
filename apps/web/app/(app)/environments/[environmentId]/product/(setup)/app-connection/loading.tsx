"use client";

import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const LoadingCard = ({ title, description, skeletonLines }) => {
  return (
    <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 text-left shadow-sm">
      <div className="grid content-center border-b border-slate-200 px-4 pb-4 text-left text-slate-900">
        <h3 className="text-lg font-medium leading-6">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="w-full">
        <div className="rounded-lg px-4">
          {skeletonLines.map((line, index) => (
            <div key={index} className="mt-4">
              <div
                className={`flex animate-pulse flex-col items-center justify-center space-y-2 rounded-lg bg-slate-200 py-6 text-center ${line.classes}`}></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Loading = () => {
  const cards = [
    {
      title: "App Connection Status",
      description: "Check if your app is successfully connected with Formbricks. Reload page to recheck.",
      skeletonLines: [{ classes: " h-44 max-w-full rounded-md" }],
    },
    {
      title: "Your EnvironmentId",
      description: "This id uniquely identifies this Formbricks environment.",
      skeletonLines: [{ classes: "h-6 w-4/6 rounded-full" }],
    },
    {
      title: "How to setup",
      description: "Follow these steps to setup the Formbricks widget within your app.",
      skeletonLines: [
        { classes: "h-6 w-24 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
        { classes: "h-6 w-24 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
        { classes: "h-4 w-60 rounded-full" },
      ],
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

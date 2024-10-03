"use client";

import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const LoadingCard = ({ title, description, skeletonLines }) => {
  return (
    <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 shadow-sm">
      <div className="grid content-center border-b border-slate-200 px-4 pb-4 text-left text-slate-900">
        <h3 className="text-lg font-medium leading-6">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      <div className="w-full">
        <div className="rounded-lg px-4 py-4 pb-0 pt-2">
          {skeletonLines.map((line, index) => (
            <div key={index} className="mt-4">
              <div className={`animate-pulse rounded-full bg-slate-200 ${line.classes}`}></div>
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
      title: "Product Name",
      description: "Change your products name.",
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: "Recontact Waiting Time",
      description: "Control how frequently users can be surveyed across all surveys.",
      skeletonLines: [{ classes: "h-4 w-28" }, { classes: "h-6 w-64" }, { classes: "h-8 w-24" }],
    },
    {
      title: "Delete Product",
      description:
        "Delete product with all surveys, responses, people, actions and attributes. This cannot be undone.",
      skeletonLines: [{ classes: "h-4 w-96" }, { classes: "h-8 w-24" }],
    },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation activeId="general" loading />
      </PageHeader>
      {cards.map((card, index) => (
        <LoadingCard key={index} {...card} />
      ))}
    </PageContentWrapper>
  );
};

export default Loading;

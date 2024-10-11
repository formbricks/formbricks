"use client";

import { LoadingCard } from "@/app/(app)/components/LoadingCard";
import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

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
    <div>
      <PageContentWrapper>
        <PageHeader pageTitle="Configuration">
          <div className="grid h-10 w-full grid-cols-[auto,1fr]">
            <nav className="flex h-full min-w-full items-center space-x-4" aria-label="Tabs">
              {navigation.map((navElem) => (
                <div
                  key={navElem.id}
                  className={cn(
                    navElem.id === "general"
                      ? "border-brand-dark border-b-2 font-semibold text-slate-900"
                      : "border-transparent text-slate-500 transition-all duration-150 ease-in-out hover:border-slate-300 hover:text-slate-700",
                    "flex h-full items-center border-b-2 px-3 text-sm font-medium",
                    navElem.hidden && "hidden"
                  )}
                  aria-current={navElem.id === "general" ? "page" : undefined}>
                  {navElem.label}
                </div>
              ))}
            </nav>
            <div className="justify-self-end"></div>
          </div>
        </PageHeader>
        {cards.map((card, index) => (
          <LoadingCard key={index} {...card} />
        ))}
      </PageContentWrapper>
    </div>
  );
};

export default Loading;

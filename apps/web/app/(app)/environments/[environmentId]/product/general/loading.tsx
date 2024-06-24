"use client";

import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@formbricks/lib/cn";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

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
  const pathname = usePathname();

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

  let navigation = [
    {
      id: "general",
      label: "General",
      icon: <UsersIcon className="h-5 w-5" />,
      current: pathname?.includes("/general"),
    },
    {
      id: "look",
      label: "Look & Feel",
      icon: <BrushIcon className="h-5 w-5" />,
      current: pathname?.includes("/look"),
    },
    {
      id: "languages",
      label: "Survey Languages",
      icon: <LanguagesIcon className="h-5 w-5" />,
      hidden: true,
      current: pathname?.includes("/languages"),
    },
    {
      id: "tags",
      label: "Tags",
      icon: <TagIcon className="h-5 w-5" />,
      current: pathname?.includes("/tags"),
    },
    {
      id: "api-keys",
      label: "API Keys",
      icon: <KeyIcon className="h-5 w-5" />,
      current: pathname?.includes("/api-keys"),
    },
    {
      id: "website-connection",
      label: "Website Connection",
      icon: <ListChecksIcon className="h-5 w-5" />,
      current: pathname?.includes("/website-connection"),
      hidden: true,
    },
    {
      id: "app-connection",
      label: "App Connection",
      icon: <ListChecksIcon className="h-5 w-5" />,
      current: pathname?.includes("/app-connection"),
      hidden: true,
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

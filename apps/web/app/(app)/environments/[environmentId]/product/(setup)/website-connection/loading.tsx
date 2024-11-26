"use client";

import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@formbricks/lib/cn";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

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
  const pathname = usePathname();

  const cards = [
    {
      title: "Widget Status",
      description: "Check if the Formbricks widget is alive and kicking.",
      skeletonLines: [{ classes: " h-44 max-w-full rounded-md" }],
    },
    {
      title: "Your EnvironmentId",
      description: "This id uniquely identifies this Formbricks environment.",
      skeletonLines: [{ classes: "h-6 w-4/6 rounded-full" }],
    },
    {
      title: "How to setup",
      description: "Follow these steps to setup the Formbricks widget within your app",
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
                    navElem.id === "website-connection"
                      ? "border-brand-dark border-b-2 font-semibold text-slate-900"
                      : "border-transparent text-slate-500 transition-all duration-150 ease-in-out hover:border-slate-300 hover:text-slate-700",
                    "flex h-full items-center border-b-2 px-3 text-sm font-medium",
                    navElem.hidden && "hidden"
                  )}
                  aria-current={navElem.id === "website-connection" ? "page" : undefined}>
                  {navElem.label}
                </div>
              ))}
            </nav>
            <div className="justify-self-end"></div>
          </div>
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

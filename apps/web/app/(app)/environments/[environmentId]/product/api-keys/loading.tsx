"use client";

import { BrushIcon, KeyIcon, LanguagesIcon, ListChecksIcon, TagIcon, UsersIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@formbricks/lib/cn";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const LoadingCard = () => {
  return (
    <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white py-4 shadow-sm">
      <div className="grid content-center border-b border-slate-200 px-4 pb-4 text-left text-slate-900">
        <h3 className="h-6 w-full max-w-56 animate-pulse rounded-lg bg-gray-100 text-lg font-medium leading-6"></h3>
        <p className="mt-3 h-4 w-full max-w-80 animate-pulse rounded-lg bg-gray-100 text-sm text-slate-500"></p>
      </div>
      <div className="w-full">
        <div className="rounded-lg px-4 pt-4">
          <div className="rounded-lg border border-slate-200">
            <div className="grid h-12 grid-cols-10 content-center rounded-t-lg bg-slate-100 px-6 text-left text-sm font-semibold text-slate-900">
              <div className="col-span-4 sm:col-span-2">Label</div>
              <div className="col-span-4 hidden sm:col-span-5 sm:block">API Key</div>
              <div className="col-span-4 sm:col-span-2">Created at</div>
            </div>
            <div className="px-6">
              <div className="my-4 h-5 w-full animate-pulse rounded-full bg-slate-200"></div>
            </div>
          </div>
          <div className="flex justify-start">
            <div className="mt-4 flex h-7 w-44 animate-pulse flex-col items-center justify-center rounded-md bg-black text-sm text-white">
              Loading
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Loading = () => {
  const pathname = usePathname();

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
                    navElem.id === "api-keys"
                      ? "border-brand-dark border-b-2 font-semibold text-slate-900"
                      : "border-transparent text-slate-500 transition-all duration-150 ease-in-out hover:border-slate-300 hover:text-slate-700",
                    "flex h-full items-center border-b-2 px-3 text-sm font-medium",
                    navElem.hidden && "hidden"
                  )}
                  aria-current={navElem.id === "api-keys" ? "page" : undefined}>
                  {navElem.label}
                </div>
              ))}
            </nav>
            <div className="justify-self-end"></div>
          </div>
        </PageHeader>
        <div className="mt-4 flex max-w-4xl animate-pulse items-center space-y-4 rounded-lg border bg-blue-50 p-6 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base"></div>

        <LoadingCard />
      </PageContentWrapper>
    </div>
  );
};

export default Loading;

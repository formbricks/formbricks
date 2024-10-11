"use client";

import { ProductConfigNavigation } from "@/app/(app)/environments/[environmentId]/product/components/ProductConfigNavigation";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

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
            <div className="mt-4 flex h-8 w-44 animate-pulse flex-col items-center justify-center rounded-md bg-black text-sm text-white">
              Loading
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Loading = () => {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Configuration">
        <ProductConfigNavigation activeId="api-keys" loading />
      </PageHeader>
      <div className="mt-4 flex max-w-4xl animate-pulse items-center space-y-4 rounded-lg border bg-blue-50 p-6 text-sm text-blue-900 shadow-sm md:space-y-0 md:text-base"></div>
      <LoadingCard />
    </PageContentWrapper>
  );
};

export default Loading;

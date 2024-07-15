import { PeopleSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PeopleSecondaryNavigation";
import { TagIcon } from "lucide-react";
import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Loading = () => {
  return (
    <>
      <PageContentWrapper>
        <PageHeader pageTitle="People">
          <PeopleSecondaryNavigation activeId="attributes" loading />
        </PageHeader>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid h-12 grid-cols-5 content-center border-b text-left text-sm font-semibold text-slate-900">
            <div className="col-span-3 pl-6">Name</div>
            <div className="text-center">Created</div>
            <div className="text-center">Last Updated</div>
          </div>
          <div className="w-full">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="m-2 grid h-16 grid-cols-5 content-center rounded-lg transition-colors ease-in-out hover:bg-slate-100">
                <div className="col-span-3 flex items-center pl-6 text-sm">
                  <div className="flex items-center">
                    <TagIcon className="h-5 w-5 flex-shrink-0 animate-pulse text-slate-500" />
                    <div className="ml-4 text-left">
                      <div className="font-medium text-slate-900">
                        <div className="mt-0 h-4 w-48 animate-pulse rounded-full bg-slate-200"></div>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        <div className="h-2 w-24 animate-pulse rounded-full bg-slate-200"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
                  <div className="m-4 h-4 animate-pulse rounded-full bg-slate-200"></div>
                </div>
                <div className="my-auto whitespace-nowrap text-center text-sm text-slate-500">
                  <div className="m-4 h-4 animate-pulse rounded-full bg-slate-200"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </PageContentWrapper>
    </>
  );
};

export default Loading;

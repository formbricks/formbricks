import { PersonSecondaryNavigation } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonSecondaryNavigation";
import { UsersIcon } from "lucide-react";
import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";

const Loading = () => {
  return (
    <>
      <PageContentWrapper>
        <PageHeader pageTitle="People">
          <PersonSecondaryNavigation activeId="segments" loading />
        </PageHeader>
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="grid h-12 grid-cols-7 content-center border-b text-left text-sm font-semibold text-slate-900">
            <div className="col-span-4 pl-6">Title</div>
            <div className="col-span-1 hidden text-center sm:block">Surveys</div>
            <div className="col-span-1 hidden text-center sm:block">Updated</div>
            <div className="col-span-1 hidden text-center sm:block">Created</div>
          </div>
          <div className="w-full">
            {[...Array(3)].map((_, index) => (
              <div
                key={index}
                className="m-2 grid h-16 grid-cols-7 content-center rounded-lg transition-colors ease-in-out hover:bg-slate-100">
                <div className="col-span-4 flex items-center pl-6 text-sm">
                  <div className="flex items-center gap-4">
                    <UsersIcon className="h-5 w-5 flex-shrink-0 animate-pulse text-slate-500" />
                    <div className="flex flex-col">
                      <div className="font-medium text-slate-900">
                        <div className="mt-0 h-4 w-48 animate-pulse rounded-full bg-slate-200"></div>
                      </div>
                      <div className="mt-1 text-xs text-slate-900">
                        <div className="h-2 w-24 animate-pulse rounded-full bg-slate-200"></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="col-span-1 my-auto whitespace-nowrap text-center text-sm text-slate-500">
                  <div className="m-4 h-4 animate-pulse rounded-full bg-slate-200"></div>
                </div>
                <div className="whitespace-wrap col-span-1 my-auto text-center text-sm text-slate-500">
                  <div className="m-4 h-4 animate-pulse rounded-full bg-slate-200"></div>
                </div>
                <div className="col-span-1 my-auto whitespace-normal text-center text-sm text-slate-500">
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

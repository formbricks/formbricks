import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";

const Loading = () => {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Surveys" />
      <div className="flex items-center justify-between">
        <div className="flex h-9 animate-pulse gap-2">
          <div className="w-48 rounded-md bg-slate-300"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-24 rounded-md bg-slate-300"></div>
          ))}
        </div>
        <div className="flex h-9 animate-pulse gap-2">
          <div className="w-9 rounded-md bg-slate-300"></div>
          <div className="w-9 rounded-md bg-slate-300"></div>
          <div className="w-36 rounded-md bg-slate-300"></div>
        </div>
      </div>
      <div className="mt-6 grid w-full grid-cols-8 place-items-center gap-3 px-6 text-sm text-slate-800">
        <div className="col-span-4 place-self-start">Name</div>
        <div className="col-span-4 grid w-full grid-cols-5 place-items-center">
          <div className="col-span-2">Created at</div>
          <div className="col-span-2">Updated at</div>
        </div>
      </div>
      {[1, 2, 3, 4].map((i) => {
        return (
          <div
            key={i}
            className="border-1 mt-6 grid h-20 w-full animate-pulse grid-cols-8 place-items-center items-center justify-center gap-3 rounded-xl border-slate-200 bg-white p-4 px-6 text-sm text-slate-800 shadow-sm">
            <div className="col-span-4 flex w-full justify-between place-self-center">
              <div className="h-4 w-24 rounded-xl bg-slate-200"></div>
              <div className="flex gap-32">
                <div className="h-4 w-16 rounded-xl bg-slate-400"></div>
                <div className="h-4 w-24 rounded-xl bg-slate-200"></div>
              </div>
            </div>
            <div className="col-span-4 grid w-full grid-cols-5 place-items-center">
              <div className="col-span-2">
                <div className="h-4 w-24 rounded-xl bg-slate-200"></div>
              </div>
              <div className="col-span-2">
                <div className="h-4 w-24 rounded-xl bg-slate-200"></div>
              </div>
            </div>
          </div>
        );
      })}
    </PageContentWrapper>
  );
};

export default Loading;

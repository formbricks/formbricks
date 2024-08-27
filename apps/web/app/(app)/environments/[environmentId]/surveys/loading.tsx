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
    </PageContentWrapper>
  );
};

export default Loading;

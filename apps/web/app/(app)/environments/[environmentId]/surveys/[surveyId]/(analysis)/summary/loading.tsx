import { PageContentWrapper } from "@formbricks/ui/components/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/components/PageHeader";
import { SkeletonLoader } from "@formbricks/ui/components/SkeletonLoader";

const Loading = () => {
  return (
    <PageContentWrapper>
      <PageHeader pageTitle="common.summary" />
      <div className="flex h-9 animate-pulse gap-2">
        <div className="h-9 w-36 rounded-full bg-slate-200"></div>
        <div className="h-9 w-36 rounded-full bg-slate-200"></div>
        <div className="h-9 w-36 rounded-full bg-slate-200"></div>
        <div className="h-9 w-36 rounded-full bg-slate-200"></div>
      </div>
      <SkeletonLoader type="summary" />
    </PageContentWrapper>
  );
};

export default Loading;

import { PageContentWrapper } from "@formbricks/ui/PageContentWrapper";
import { PageHeader } from "@formbricks/ui/PageHeader";
import { SkeletonLoader } from "@formbricks/ui/SkeletonLoader";

const LoadingCard = ({ title, percentage }) => {
  return (
    <div className="flex h-full animate-pulse cursor-default flex-col justify-between space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
      <p className="flex items-center gap-1 text-sm text-slate-600">
        {title}
        {percentage && <div className="ml-1 h-4 w-6 rounded-md bg-slate-300"></div>}
      </p>
      <div className="h-6 w-10 rounded-md bg-slate-300"></div>
    </div>
  );
};

const Loading = () => {
  const cards = [
    { title: "Impressions", percentage: false },
    { title: "Starts", percentage: true },
    { title: "Completed", percentage: true },
    { title: "Drop-Offs", percentage: true },
    { title: "Time to Complete", percentage: false },
  ];

  return (
    <PageContentWrapper>
      <PageHeader pageTitle="Summary" />
      <div className="grid h-10 w-full grid-cols-[auto,1fr]">
        <nav className="flex h-full min-w-full items-center space-x-4" aria-label="Tabs">
          {[1, 2].map((index) => (
            <span
              key={index}
              aria-disabled="true"
              className="flex h-full w-28 animate-pulse items-center rounded-md border-b-2 bg-slate-300 px-3 text-sm font-medium text-slate-500">
              {/* Simulate a tab label */}
              <div className="h-4 w-full bg-slate-300"></div>
            </span>
          ))}
        </nav>
        <div className="justify-self-end"></div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5 md:gap-x-2 lg:col-span-4">
        {cards.map((card, index) => (
          <LoadingCard key={index} {...card} />
        ))}
      </div>
      <div className="flex h-9 animate-pulse gap-2">
        <div className="h-9 w-36 rounded-md bg-slate-300"></div>
        <div className="h-9 w-36 rounded-md bg-slate-300"></div>
        <div className="h-9 w-36 rounded-md bg-slate-300"></div>
        <div className="h-9 w-36 rounded-md bg-slate-300"></div>
      </div>
      <SkeletonLoader type="summary" />
    </PageContentWrapper>
  );
};

export default Loading;

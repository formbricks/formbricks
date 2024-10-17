import { cn } from "@formbricks/lib/cn";

export interface PageHeaderProps {
  pageTitle: string;
  cta?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader = ({ cta, pageTitle, children }: PageHeaderProps) => {
  return (
    <>
      <div
        className={cn(
          "relative w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm",
          "sticky top-14 z-10 bg-white" // Keep the sticky header
        )}>
        <div className="flex items-center justify-between space-x-4 pb-4">
          <h1 className={cn("text-3xl font-bold text-slate-800")}>{pageTitle}</h1>
          {cta}
        </div>
        {children}
      </div>
    </>
  );
};

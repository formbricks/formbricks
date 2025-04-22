import { cn } from "@formbricks/lib/cn";

export interface PageHeaderProps {
  pageTitle: string;
  cta?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader = ({ cta, pageTitle, children }: PageHeaderProps) => {
  return (
    <div className="border-b border-slate-200">
      <div className="flex items-center justify-between space-x-4 pb-4">
        <h1 className={cn("text-3xl font-bold text-slate-800 capitalize")}>{pageTitle}</h1>
        {cta}
      </div>
      {children}
    </div>
  );
};

import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  pageTitle: React.ReactNode;
  cta?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader = ({ cta, pageTitle, children }: PageHeaderProps) => {
  return (
    <div className="border-b border-slate-200">
      <div className="flex items-center justify-between gap-x-4 pb-4">
        <h1 className={cn("text-3xl font-bold text-slate-800")}>{pageTitle}</h1>
        {cta}
      </div>
      {children}
    </div>
  );
};

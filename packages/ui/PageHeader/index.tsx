import { cn } from "@formbricks/lib/cn";

interface PageHeaderProps {
  pageTitle: string;
  cta?: React.ReactNode;
}

export const PageHeader = ({ cta, pageTitle }: PageHeaderProps) => {
  return (
    <div className="flex items-center space-x-4">
      <h1 className={cn("text-3xl font-bold text-slate-800")}>{pageTitle}</h1>
      {cta}
    </div>
  );
};

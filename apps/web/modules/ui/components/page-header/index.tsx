import { cn } from "@formbricks/lib/cn";

export interface PageHeaderProps {
  pageTitle: string;
  pageTitleAddon?: React.ReactNode;
  cta?: React.ReactNode;
  children?: React.ReactNode;
}

export const PageHeader = ({ cta, pageTitleAddon, pageTitle, children }: PageHeaderProps) => {
  return (
    <div className="border-b border-slate-200">
      <div className="flex items-center justify-between space-x-4 pb-4">
        <div>
          <h1>
            <span className="text-3xl font-bold capitalize text-slate-800">{pageTitle}</span>
            {pageTitleAddon && <span className="ml-4 inline-block whitespace-nowrap">{pageTitleAddon}</span>}
          </h1>
        </div>
        {cta}
      </div>
      {children}
    </div>
  );
};

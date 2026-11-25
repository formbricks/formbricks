import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  readonly pageTitle: React.ReactNode;
  readonly cta?: React.ReactNode;
  readonly wrapCta?: boolean;
  readonly children?: React.ReactNode;
}

export const PageHeader = ({ cta, pageTitle, wrapCta, children }: PageHeaderProps) => {
  return (
    <div className="border-b border-slate-200">
      <div className={cn("flex items-center justify-between gap-x-4 pb-4", wrapCta && "flex-wrap gap-y-3")}>
        <h1
          className={cn("min-w-0 text-3xl font-bold break-words text-slate-800", wrapCta && "grow basis-72")}>
          {pageTitle}
        </h1>
        {cta}
      </div>
      {children}
    </div>
  );
};

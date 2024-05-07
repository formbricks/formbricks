import { cn } from "@formbricks/lib/cn";

interface InnerContentWrapperProps {
  children: React.ReactNode;
  className?: string;
  pageTitle?: string;
  cta?: React.ReactNode;
}

export const InnerContentWrapper = ({ children, className, pageTitle, cta }: InnerContentWrapperProps) => {
  return (
    <div className={cn("max-w-8xl flex-1 space-y-6 overflow-y-auto px-6 pb-12 pt-14", className)}>
      <div className="flex items-center space-x-4">
        {pageTitle && <h1 className={cn("text-3xl font-bold text-slate-800")}>{pageTitle}</h1>}
        {cta}
      </div>
      {children}
    </div>
  );
};

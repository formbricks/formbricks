import { cn } from "@formbricks/lib/cn";

interface ContentWrapperProps {
  children: React.ReactNode;
  className?: string;
  pageTitle?: string;
  isPageTitleCollapsed?: boolean;
}

export const ContentWrapper = ({
  children,
  className,
  pageTitle,

  isPageTitleCollapsed,
}: ContentWrapperProps) => {
  return (
    <div className={cn("flex-1 overflow-y-auto pb-24 pl-8", className)}>
      {pageTitle && (
        <h1 className={cn("mb-6 text-3xl font-bold text-slate-800", isPageTitleCollapsed && "absolute")}>
          {pageTitle}
        </h1>
      )}
      {children}
    </div>
  );
};

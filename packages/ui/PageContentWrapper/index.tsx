import { cn } from "@formbricks/lib/cn";

interface PageContentWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContentWrapper = ({ children, className }: PageContentWrapperProps) => {
  return (
    <div className={cn("max-w-8xl flex-1 space-y-6 overflow-y-auto px-6 pb-6 pt-3", className)}>
      {children}
    </div>
  );
};

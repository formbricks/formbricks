import { cn } from "@formbricks/lib/cn";

interface PageContentWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContentWrapper = ({ children, className }: PageContentWrapperProps) => {
  return <div className={cn("space-y-6 overflow-y-auto p-6", className)}>{children}</div>;
};

import { cn } from "@formbricks/lib/cn";

interface PageContentWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContentWrapper = ({ children, className }: PageContentWrapperProps) => {
  return <div className={cn("h-full space-y-6 p-4 md:p-6", className)}>{children}</div>;
};

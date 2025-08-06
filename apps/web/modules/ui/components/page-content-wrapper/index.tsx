import { cn } from "@/lib/cn";

interface PageContentWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContentWrapper = ({ children, className }: PageContentWrapperProps) => {
  return <div className={cn("min-h-full space-y-6 p-6", className)}>{children}</div>;
};

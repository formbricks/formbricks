import { cn } from "@/lib/cn";

interface PageContentWrapperProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

export const PageContentWrapper = ({ children, className }: PageContentWrapperProps) => {
  return <div className={cn("min-h-full space-y-6 p-6", className)}>{children}</div>;
};

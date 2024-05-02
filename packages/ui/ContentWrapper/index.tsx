import { cn } from "@formbricks/lib/cn";

interface ContentWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export const ContentWrapper = ({ children, className }: ContentWrapperProps) => {
  return <div className={cn("max-w-7xl flex-1 overflow-y-auto px-8 pb-24 pt-6", className)}>{children}</div>;
};

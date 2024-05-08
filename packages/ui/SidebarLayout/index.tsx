import { cn } from "@formbricks/lib/cn";

interface SidebarLayoutProps {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  className?: string;
}

export const SidebarLayout = ({ children, sidebar, className }: SidebarLayoutProps) => {
  return (
    <div className={cn("max-w-8xl flex", className)}>
      {sidebar}
      <div className="w-full">{children}</div>
    </div>
  );
};

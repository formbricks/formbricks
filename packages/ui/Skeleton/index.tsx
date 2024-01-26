import { cn } from "@formbricks/lib/cn";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-full bg-slate-200", className)} {...props}></div>;
}

export { Skeleton };

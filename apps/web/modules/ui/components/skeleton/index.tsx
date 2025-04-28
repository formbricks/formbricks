import { cn } from "@/lib/cn";

export const Skeleton = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => {
  return <div className={cn("animate-pulse rounded-full bg-slate-200", className)} {...props}></div>;
};

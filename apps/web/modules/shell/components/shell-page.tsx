import { cn } from "@/lib/cn";

/** The content column every shell page uses: 960px max, 24px rhythm. */
export const ShellPage = ({
  className,
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) => (
  <div className={cn("mx-auto flex max-w-240 flex-col gap-6", className)}>{children}</div>
);

/** Page heading with an optional call to action, for pages that are not part of a tabbed section. */
export const ShellPageHeader = ({
  title,
  lead,
  cta,
}: Readonly<{ title: React.ReactNode; lead?: React.ReactNode; cta?: React.ReactNode }>) => (
  <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
      <h1 className="text-2xl font-bold text-slate-800 md:text-3xl">{title}</h1>
      {cta}
    </div>
    {lead && <p className="max-w-[68ch] text-base text-slate-600">{lead}</p>}
  </div>
);

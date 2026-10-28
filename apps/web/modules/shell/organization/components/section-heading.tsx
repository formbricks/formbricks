import { cn } from "@/lib/cn";

/** Heading of one section on an organization page, with an optional call to action on the right. */
export const SectionHeading = ({
  title,
  description,
  cta,
}: Readonly<{ title: React.ReactNode; description?: React.ReactNode; cta?: React.ReactNode }>) => (
  <div className="flex flex-wrap items-start justify-between gap-4">
    <div className="max-w-[68ch]">
      <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
      {description && <p className="mt-0.5 text-slate-500">{description}</p>}
    </div>
    {cta}
  </div>
);

/** The bordered box every table sits in; the table scrolls inside it rather than the page. */
export const TableFrame = ({
  className,
  children,
}: Readonly<{ className?: string; children: React.ReactNode }>) => (
  <div className={cn("overflow-hidden rounded-xl border border-slate-200 bg-white", className)}>
    {children}
  </div>
);

export const TABLE_HEAD_CLASS = "font-semibold text-slate-800";

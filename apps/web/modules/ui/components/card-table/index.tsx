import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CardTableProps {
  children: ReactNode;
  className?: string;
}

export const CardTable = ({ children, className }: Readonly<CardTableProps>) => (
  <div className={cn("space-y-3", className)}>{children}</div>
);

interface CardTableHeaderProps {
  /** Column-template classes, e.g. `grid-cols-5`. */
  className?: string;
  children: ReactNode;
}

export const CardTableHeader = ({ className, children }: Readonly<CardTableHeaderProps>) => (
  <div
    className={cn("mt-6 grid w-full place-items-center gap-3 px-6 pr-8 text-sm text-slate-800", className)}>
    {children}
  </div>
);

interface CardTableRowProps {
  href: string;
  /** Column-template classes, e.g. `grid-cols-5`. Must match the header. */
  className?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export const CardTableRow = ({ href, className, actions, children }: Readonly<CardTableRowProps>) => (
  <div className="relative block">
    <Link
      href={href}
      className={cn(
        "grid w-full place-items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 pr-8 shadow-sm transition-colors ease-in-out hover:border-slate-400",
        className
      )}>
      {children}
    </Link>
    {actions ? <div className="absolute right-3 top-3.5">{actions}</div> : null}
  </div>
);

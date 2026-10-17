"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Tabs, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";

export const EditorPanel = ({
  title,
  icon: Icon,
  description,
  children,
  className,
}: Readonly<{
  title: string;
  icon?: LucideIcon;
  description?: string;
  children: React.ReactNode;
  className?: string;
}>) => (
  <section className={cn("space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs", className)}>
    <header className="space-y-1">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        {Icon && <Icon className="size-4 text-slate-500" aria-hidden="true" />}
        {title}
      </h3>
      {description && <p className="text-xs text-slate-500">{description}</p>}
    </header>
    {children}
  </section>
);

export const EditorField = ({
  label,
  htmlFor,
  hint,
  children,
  className,
}: Readonly<{
  label: string;
  htmlFor?: string;
  /** Shown muted after the label, e.g. "Optional" or "From top". */
  hint?: string;
  children: React.ReactNode;
  className?: string;
}>) => (
  <div className={cn("space-y-1.5", className)}>
    <label htmlFor={htmlFor} className="flex items-baseline gap-1.5 text-sm font-medium text-slate-700">
      {label}
      {hint && <span className="text-xs font-normal text-slate-400">{hint}</span>}
    </label>
    {children}
  </div>
);

export interface TSegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Icon-only segments still need a name for assistive tech. */
  hideLabel?: boolean;
}

/** A small segmented control on top of the kit Tabs, for picks among two to four options. */
export const Segmented = <T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  fill,
}: Readonly<{
  value: T;
  onChange: (value: T) => void;
  options: TSegmentOption<T>[];
  ariaLabel: string;
  fill?: boolean;
}>) => (
  <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
    <TabsList aria-label={ariaLabel} width={fill ? "fill" : "fit"}>
      {options.map(({ value: optionValue, label, icon: Icon, hideLabel }) => (
        <TabsTrigger
          key={optionValue}
          value={optionValue}
          aria-label={hideLabel ? label : undefined}
          icon={Icon ? <Icon className="size-4" aria-hidden="true" /> : undefined}
          className="gap-1.5">
          {hideLabel ? null : label}
        </TabsTrigger>
      ))}
    </TabsList>
  </Tabs>
);

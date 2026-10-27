"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon, type LucideIcon } from "lucide-react";
import { type ReactNode, createContext, useContext } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Tabs, TabsList, TabsTrigger } from "@/modules/ui/components/tabs";
import type { TEditorPanelId } from "../../lib/editor-panels";

interface TEditorPanels {
  openPanels: ReadonlySet<TEditorPanelId>;
  setPanelsOpen: (ids: readonly TEditorPanelId[], open: boolean) => void;
}

/**
 * Which folding panels are open. The editor keeps it above the tabs, which unmount when switched, so a
 * panel stays open across tab switches, and so a flagged issue can open the panel that fixes it.
 */
const EditorPanelsContext = createContext<TEditorPanels | null>(null);

export const EditorPanelsProvider = ({
  openPanels,
  setPanelsOpen,
  children,
}: Readonly<TEditorPanels & { children: ReactNode }>) => (
  <EditorPanelsContext.Provider value={{ openPanels, setPanelsOpen }}>
    {children}
  </EditorPanelsContext.Provider>
);

export const useEditorPanels = (): TEditorPanels => {
  const panels = useContext(EditorPanelsContext);
  if (!panels) throw new Error("useEditorPanels must be used within an EditorPanelsProvider");
  return panels;
};

export interface TEditorPanelFold {
  id: TEditorPanelId;
  /** What the closed header says about the panel's values: text, swatches or an icon, never a control. */
  summary: ReactNode;
  /** A dot in the header, open or closed. Only a mark: the editor opens panels for flagged issues. */
  attention?: "error" | "warning";
}

type TEditorPanelProps = {
  title: string;
  icon?: LucideIcon;
  description?: string;
  children: ReactNode;
  className?: string;
} & (
  | {
      /** A control at the header's end that scopes the whole card. Not on a folding panel. */
      action?: ReactNode;
      fold?: never;
    }
  | {
      /** Folds the panel to one row whose header is its toggle, so it takes no `action`. */
      fold: TEditorPanelFold;
      action?: never;
    }
);

export const EditorPanel = ({
  title,
  icon: Icon,
  description,
  action,
  fold,
  children,
  className,
}: Readonly<TEditorPanelProps>) => {
  if (fold) {
    return (
      <FoldingEditorPanel
        title={title}
        icon={Icon}
        description={description}
        fold={fold}
        className={className}>
        {children}
      </FoldingEditorPanel>
    );
  }
  return (
    <section className={cn("space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-xs", className)}>
      <header className="space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            {Icon && <Icon className="size-4 text-slate-500" aria-hidden="true" />}
            {title}
          </h3>
          {action}
        </div>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </header>
      {children}
    </section>
  );
};

const AttentionDot = ({ kind }: Readonly<{ kind: NonNullable<TEditorPanelFold["attention"]> }>) => {
  const { t } = useTranslation();
  return (
    <>
      <span
        className={cn("size-1.5 shrink-0 rounded-full", kind === "error" ? "bg-red-500" : "bg-amber-500")}
        aria-hidden="true"
      />
      <span className="sr-only">{kind === "error" ? t("common.error") : t("common.warning")}</span>
    </>
  );
};

/**
 * A panel folded to its header: icon, title, an attention dot, and its summary at the end while closed.
 * The summary is part of the toggle's accessible name ("Colors, 2 of 3 set") and leaves it while open.
 */
const FoldingEditorPanel = ({
  title,
  icon: Icon,
  description,
  fold,
  children,
  className,
}: Readonly<{
  title: string;
  icon?: LucideIcon;
  description?: string;
  fold: TEditorPanelFold;
  children: ReactNode;
  className?: string;
}>) => {
  const { openPanels, setPanelsOpen } = useEditorPanels();
  return (
    <Collapsible.Root
      open={openPanels.has(fold.id)}
      onOpenChange={(open) => setPanelsOpen([fold.id], open)}
      className={cn("rounded-xl border border-slate-200 bg-white shadow-xs", className)}>
      <h3 className="text-sm">
        <Collapsible.Trigger className="group flex w-full items-center gap-2 rounded-xl px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:outline-hidden data-[state=open]:rounded-b-none">
          {Icon && <Icon className="size-4 shrink-0 text-slate-500" aria-hidden="true" />}
          <span className="font-semibold whitespace-nowrap text-slate-900">{title}</span>
          {fold.attention && <AttentionDot kind={fold.attention} />}
          <span className="ml-auto flex min-w-0 items-center gap-2 text-xs text-slate-500 group-data-[state=open]:invisible">
            {fold.summary}
          </span>
          <ChevronDownIcon
            className="size-4 shrink-0 text-slate-400 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
            aria-hidden="true"
          />
        </Collapsible.Trigger>
      </h3>
      <Collapsible.Content className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down motion-reduce:animate-none">
        <div className="space-y-4 px-5 pb-5">
          {description && <p className="text-xs text-slate-500">{description}</p>}
          {children}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

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

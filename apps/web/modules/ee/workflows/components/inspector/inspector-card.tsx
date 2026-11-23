import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * One group of a step panel: a short title (with an optional one-line purpose and a control on the
 * right), the fields that answer that one question, and an optional footer note. Panels use one card
 * per question the user answers ("which survey", "when does Then run", "who gets it"), so related
 * fields read together and the help text sits next to what it explains. The step name stays above
 * the cards, uncarded, as the step's identity. Don't wrap a single obvious field in a card of its own.
 */
export const InspectorCard = ({
  title,
  description,
  aside,
  footer,
  children,
  bodyClassName,
}: Readonly<{
  title: ReactNode;
  description?: ReactNode;
  /** A control in the header, e.g. a view switch or a "Required" tag. */
  aside?: ReactNode;
  /** A short note under the fields, e.g. what happens to runs that match nothing. */
  footer?: ReactNode;
  children?: ReactNode;
  /** Override the body's spacing, e.g. for a list that runs edge to edge. */
  bodyClassName?: string;
}>) => (
  <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
    {/* The divider and semibold title set the card's heading apart from the field labels inside it. */}
    <header
      className={cn(
        "flex items-start justify-between gap-3 px-3 py-2.5",
        children ? "border-b border-slate-100" : undefined
      )}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
      {aside}
    </header>
    {children ? <div className={cn("flex flex-col gap-3 p-3", bodyClassName)}>{children}</div> : null}
    {footer ? (
      <footer className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {footer}
      </footer>
    ) : null}
  </section>
);

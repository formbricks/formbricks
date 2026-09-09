import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// `children` comes from HTMLAttributes, so a caller spreading its own props onto this keeps working.
type KbdProps = Readonly<HTMLAttributes<HTMLElement>>;

/**
 * A single key cap, for advertising a keyboard shortcut next to the control it triggers.
 *
 * `<kbd>` rather than a styled span: it is the element for keyboard input, so the shortcut reads as
 * a key rather than as part of the label around it.
 *
 * Set `aria-hidden` where the shortcut is already announced another way - a button carrying
 * `aria-keyshortcuts`, say - so a screen reader does not read the same key twice.
 */
export const Kbd = ({ children, className, ...props }: KbdProps) => (
  <kbd
    className={cn(
      "rounded border border-slate-200 bg-slate-100 px-1.5 py-1 font-mono text-xs leading-none font-semibold text-slate-600",
      className
    )}
    {...props}>
    {children}
  </kbd>
);

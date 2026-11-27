"use client";

import { BookUserIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/modules/ui/components/tooltip";

interface ContactDirectoryIndicatorProps {
  /** "<directory> directory", the tooltip and the accessible name. */
  readonly label: string;
  /** The Directories settings page, for owners and managers; absent, the icon is a hint only. */
  readonly href?: string;
  /** Overrides the size, e.g. to match the contact page's icon bar (38px) instead of a small button (32px). */
  readonly className?: string;
}

/**
 * Spec decision 20: which directory the workspace uses, shown in the Contacts header next to the page's
 * button only when other workspaces share it. An icon with the directory's name as its tooltip; for owners
 * and managers it links to Organization settings › Directories.
 *
 * A client component on purpose: `TooltipTrigger asChild` clones its child with Radix's Slot, which renders
 * nothing during SSR when that child comes from a server component as a lazy reference, and the client then
 * fails to hydrate.
 */
export const ContactDirectoryIndicator = ({ label, href, className }: ContactDirectoryIndicatorProps) => (
  <TooltipProvider delayDuration={0}>
    <Tooltip>
      <TooltipTrigger asChild>
        {href ? (
          <Button asChild variant="secondary" size="icon" className={cn("size-8", className)}>
            <Link href={href} aria-label={label}>
              <BookUserIcon aria-hidden="true" />
            </Link>
          </Button>
        ) : (
          // Not a button: members can't open the settings page. The name is in screen-reader text, so it is
          // announced without a focus stop that does nothing.
          <span
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-md border border-primary/5 bg-secondary text-secondary-foreground",
              className
            )}>
            <BookUserIcon className="size-4" aria-hidden="true" />
            <span className="sr-only">{label}</span>
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

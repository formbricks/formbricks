"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";

interface InspectorSectionProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}

export const InspectorSection = ({
  title,
  description,
  defaultOpen = false,
  className,
  children,
}: Readonly<InspectorSectionProps>) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn("overflow-hidden rounded-lg border border-slate-200 bg-white", className)}>
      <Collapsible.CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full items-center justify-between rounded-none px-4 py-3 text-left font-normal hover:bg-slate-50">
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-slate-900">{title}</span>
            {description ? <span className="mt-0.5 text-xs text-slate-500">{description}</span> : null}
          </div>
          <ChevronDownIcon
            className={cn("shrink-0 text-slate-500 transition-transform", open ? "rotate-0" : "-rotate-90")}
          />
        </Button>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>{children}</Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

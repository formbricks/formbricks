"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";
import { MetadataEntryRow } from "./metadata-entry-row";

interface EmbeddedDataEntriesProps {
  entries: { key: string; value: string }[];
}

export const EmbeddedDataEntries = ({ entries }: Readonly<EmbeddedDataEntriesProps>) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible.Root open={isOpen} onOpenChange={setIsOpen} className="space-y-2">
      <Collapsible.Trigger asChild>
        <Button type="button" variant="ghost" size="sm" className="w-full justify-between px-2">
          <span>
            {t("common.embedded_data")} <span className="font-normal text-slate-500">{entries.length}</span>
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className={cn("size-4 motion-safe:transition-transform", isOpen && "rotate-180")}
          />
        </Button>
      </Collapsible.Trigger>
      <Collapsible.Content className="space-y-2">
        {entries.map((entry) => (
          <MetadataEntryRow key={entry.key} label={entry.key} value={entry.value} />
        ))}
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

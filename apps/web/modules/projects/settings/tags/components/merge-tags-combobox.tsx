"use client";

import { Button } from "@/modules/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { useTranslate } from "@tolgee/react";
import { useState } from "react";

interface MergeTagsComboboxProps {
  tags: Tag[];
  onSelect: (tagId: string) => void;
}

type Tag = {
  label: string;
  value: string;
};

export const MergeTagsCombobox = ({ tags, onSelect }: MergeTagsComboboxProps) => {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="font-medium text-slate-900 focus:border-transparent focus:shadow-transparent focus:outline-transparent focus:ring-0 focus:ring-transparent">
          {t("environments.project.tags.merge")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-60 w-[200px] overflow-y-auto p-0">
        <Command>
          <div className="p-1">
            <CommandInput
              placeholder={t("environments.project.tags.search_tags")}
              className="border-b border-none border-transparent shadow-none outline-0 ring-offset-transparent focus:border-none focus:border-transparent focus:shadow-none focus:outline-0 focus:ring-offset-transparent"
            />
          </div>
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-sm text-slate-500">{t("environments.project.tags.no_tag_found")}</div>
            </CommandEmpty>
            <CommandGroup>
              {tags?.length === 0 ? (
                <CommandItem>{t("environments.project.tags.no_tag_found")}</CommandItem>
              ) : null}

              {tags?.map((tag) => (
                <CommandItem
                  key={tag.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                    onSelect(tag.value);
                  }}>
                  {tag.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

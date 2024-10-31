import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@formbricks/ui/components/Button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@formbricks/ui/components/Command";
import { Popover, PopoverContent, PopoverTrigger } from "@formbricks/ui/components/Popover";

interface IMergeTagsComboboxProps {
  tags: Tag[];
  onSelect: (tagId: string) => void;
}

type Tag = {
  label: string;
  value: string;
};

export const MergeTagsCombobox = ({ tags, onSelect }: IMergeTagsComboboxProps) => {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="font-medium text-slate-900 focus:border-transparent focus:shadow-transparent focus:outline-transparent focus:ring-0 focus:ring-transparent">
          {t("environments.product.tags.merge")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-60 w-[200px] overflow-y-auto p-0">
        <Command>
          <div className="p-1">
            <CommandInput
              placeholder={t("environments.product.tags.search_tags")}
              className="border-b border-none border-transparent shadow-none outline-0 ring-offset-transparent focus:border-none focus:border-transparent focus:shadow-none focus:outline-0 focus:ring-offset-transparent"
            />
          </div>
          <CommandList>
            <CommandEmpty>
              <div className="p-2 text-sm text-slate-500">{t("environments.product.tags.no_tag_found")}</div>
            </CommandEmpty>
            <CommandGroup>
              {tags?.length === 0 ? (
                <CommandItem>{t("environments.product.tags.no_tag_found")}</CommandItem>
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

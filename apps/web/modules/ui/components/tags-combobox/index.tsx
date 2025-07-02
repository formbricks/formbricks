"use client";

import { Button } from "@/modules/ui/components/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";
import { useTranslate } from "@tolgee/react";
import { useEffect, useMemo } from "react";

interface ITagsComboboxProps {
  tags: Tag[];
  currentTags: Tag[];
  addTag: (tagId: string) => void;
  createTag?: (tagName: string) => void;
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

type Tag = {
  label: string;
  value: string;
};

export const TagsCombobox = ({
  tags,
  currentTags,
  addTag,
  createTag,
  searchValue,
  setSearchValue,
  open,
  setOpen,
}: ITagsComboboxProps) => {
  const { t } = useTranslate();
  const tagsToSearch = useMemo(
    () =>
      tags.filter((tag) => {
        const found = currentTags.findIndex(
          (currentTag) => currentTag.value.toLowerCase() === tag.value.toLowerCase()
        );

        return found === -1;
      }),
    [currentTags, tags]
  );

  useEffect(() => {
    // reset search value and value when closing the combobox
    if (!open) {
      setSearchValue("");
    }
  }, [open, setSearchValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" aria-expanded={open}>
          {t("environments.project.tags.add_tag")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-60 w-[200px] overflow-y-auto p-0">
        <Command
          filter={(value, search) => {
            if (value === "_create") {
              return 1;
            }
            const foundLabel = tagsToSearch.find((tag) => tag.value.toLowerCase() === value)?.label ?? "";

            if (foundLabel.toLowerCase().includes(search.toLowerCase())) {
              return 1;
            }

            return 0;
          }}>
          <div className="p-1">
            <CommandInput
              placeholder={
                tagsToSearch?.length === 0
                  ? t("environments.project.tags.add_tag")
                  : t("environments.project.tags.search_tags")
              }
              className="border-b border-none border-transparent shadow-none outline-0 ring-offset-transparent focus:border-none focus:border-transparent focus:shadow-none focus:outline-0 focus:ring-offset-transparent"
              value={searchValue}
              onValueChange={(search) => setSearchValue(search)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchValue !== "") {
                  const alreadyExists =
                    currentTags.some((tag) => tag.label === searchValue) ||
                    tagsToSearch.some((tag) => tag.label === searchValue);

                  if (!alreadyExists) {
                    createTag?.(searchValue);
                  }
                }
              }}
            />
          </div>
          <CommandList>
            <CommandGroup>
              {tagsToSearch?.map((tag) => {
                return (
                  <CommandItem
                    key={tag.value}
                    value={tag.value}
                    onSelect={(currentValue) => {
                      setOpen(false);
                      addTag(currentValue);
                    }}
                    className="hover:cursor-pointer hover:bg-slate-50">
                    {tag.label}
                  </CommandItem>
                );
              })}
              {searchValue !== "" &&
                !currentTags.find((tag) => tag.label === searchValue) &&
                !tagsToSearch.find((tag) => tag.label === searchValue) && (
                  <CommandItem value="_create">
                    <button
                      onClick={() => createTag?.(searchValue)}
                      className="h-8 w-full text-left hover:cursor-pointer hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!!currentTags.find((tag) => tag.label === searchValue)}>
                      + {t("environments.project.tags.add")} {searchValue}
                    </button>
                  </CommandItem>
                )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

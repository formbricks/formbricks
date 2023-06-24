"use client";

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@formbricks/ui";
import { useEffect } from "react";
import { useMemo } from "react";

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

const TagsCombobox: React.FC<ITagsComboboxProps> = ({
  tags,
  currentTags,
  addTag,
  createTag,
  searchValue,
  setSearchValue,
  open,
  setOpen,
}) => {
  const tagsToSearch = useMemo(
    () =>
      tags.filter((tag) => {
        const found = currentTags.findIndex((currentTag) => currentTag.value === tag.value);

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
        <Button variant="darkCTA" size="sm" aria-expanded={open}>
          Add Tag
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-60 w-[200px] overflow-y-auto p-0">
        <Command
          filter={(value, search) => {
            const foundLabel = tagsToSearch.find((tag) => tag.value === value)?.label ?? "";

            if (foundLabel.includes(search)) {
              return 1;
            }

            return 0;
          }}>
          <div className="p-1">
            <CommandInput
              placeholder={tagsToSearch?.length === 0 ? "Add tag..." : "Search or add tags..."}
              className="border-none border-transparent shadow-none outline-0 ring-offset-transparent focus:border-none focus:border-transparent focus:shadow-none focus:outline-0 focus:ring-offset-transparent"
              value={searchValue}
              onValueChange={(search) => setSearchValue(search)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchValue !== "") {
                  if (
                    !tagsToSearch?.find((tag) =>
                      tag?.label?.toLowerCase().includes(searchValue?.toLowerCase())
                    )
                  ) {
                    createTag?.(searchValue);
                  }
                }
              }}
            />
          </div>
          <CommandEmpty className="p-3">
            <a
              onClick={() => createTag?.(searchValue)}
              className="text-muted-foreground flex h-6 cursor-pointer items-center justify-center hover:bg-slate-50 focus:!shadow-none focus:outline-none">
              + Add {searchValue}
            </a>
          </CommandEmpty>
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
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default TagsCombobox;

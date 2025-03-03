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
import { useEffect } from "react";

type Key = {
  label: string;
  value: string;
};

interface ITagsComboboxProps {
  keys: Key[];
  addKey: (tagId: string) => void;
  createKey: (tagName: string) => void;
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  currentKey: Key | null;
}

export const UploadContactsAttributeCombobox = ({
  keys,
  addKey,
  createKey,
  searchValue,
  setSearchValue,
  open,
  setOpen,
  currentKey,
}: ITagsComboboxProps) => {
  const { t } = useTranslate();
  useEffect(() => {
    // reset search value and value when closing the combobox
    if (!open) {
      setSearchValue("");
    }
  }, [open, setSearchValue]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {currentKey ? (
          <Button variant="ghost" size="sm" className="border border-slate-300" aria-expanded={open}>
            {currentKey.label}
          </Button>
        ) : (
          <Button variant="ghost" size="sm" className="border border-slate-300" aria-expanded={open}>
            {t("environments.contacts.select_attribute")}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="h-full w-[200px] overflow-y-auto p-0">
        <Command
          filter={(value, search) => {
            if (value === "_create") {
              return 1;
            }
            const foundLabel = keys.find((tag) => tag.value.toLowerCase() === value)?.label ?? "";

            if (foundLabel.toLowerCase().includes(search.toLowerCase())) {
              return 1;
            }

            return 0;
          }}>
          <div className="p-1">
            <CommandInput
              placeholder={
                keys?.length === 0
                  ? "Add attribute"
                  : t("environments.contacts.upload_contacts_modal_attributes_search_or_add")
              }
              className="border-b border-none border-transparent shadow-none outline-0 ring-offset-transparent focus:border-none focus:border-transparent focus:shadow-none focus:outline-0 focus:ring-offset-transparent"
              value={searchValue}
              onValueChange={(search) => setSearchValue(search)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchValue !== "") {
                  if (!keys.find((tag) => tag?.label?.toLowerCase().includes(searchValue?.toLowerCase()))) {
                    createKey(searchValue);
                  }
                }
              }}
            />
          </div>
          <CommandList>
            <CommandGroup>
              {keys.map((tag) => {
                return (
                  <CommandItem
                    key={tag.value}
                    value={tag.value}
                    onSelect={(currentValue) => {
                      setOpen(false);
                      addKey(currentValue);
                    }}
                    className="hover:cursor-pointer hover:bg-slate-50">
                    {tag.label}
                  </CommandItem>
                );
              })}
              {searchValue !== "" &&
                !keys.find((tag) => tag.label === searchValue) &&
                !keys.find((tag) => tag.label === searchValue) && (
                  <CommandItem value="_create">
                    <button
                      onClick={() => createKey(searchValue)}
                      className="h-8 w-full text-left hover:cursor-pointer hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!!keys.find((tag) => tag.label === searchValue)}>
                      + Add {searchValue}
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

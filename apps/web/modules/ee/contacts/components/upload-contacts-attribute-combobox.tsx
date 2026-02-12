"use client";

import { ChevronDownIcon } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { isSafeIdentifier } from "@/lib/utils/safe-identifier";
import { Button } from "@/modules/ui/components/button";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/ui/components/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/modules/ui/components/popover";

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
  const { t } = useTranslation();
  useEffect(() => {
    // reset search value and value when closing the combobox
    if (!open) {
      setSearchValue("");
    }
  }, [open, setSearchValue]);

  // Check if the search value is a valid safe identifier for creating new attributes
  const isValidNewKey = useMemo(() => {
    if (!searchValue) return false;
    return isSafeIdentifier(searchValue.trim());
  }, [searchValue]);

  const existingKeyMatch = useMemo(() => {
    return keys.find((tag) => tag?.label?.toLowerCase().includes(searchValue?.toLowerCase()));
  }, [keys, searchValue]);

  const handleCreateKey = () => {
    if (isValidNewKey && !existingKeyMatch) {
      createKey(searchValue.trim());
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {currentKey ? (
          <Button
            variant="ghost"
            size="sm"
            className="justify-between border border-slate-300"
            aria-expanded={open}>
            {currentKey.label}
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="justify-between border border-slate-300"
            aria-expanded={open}>
            {t("environments.contacts.select_attribute")}
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent className="h-full w-[200px] p-0">
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
                  handleCreateKey();
                }
              }}
            />
          </div>
          <CommandList className="max-h-[300px] overflow-y-auto border-0">
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
              {searchValue !== "" && !keys.some((tag) => tag.label === searchValue) && (
                <CommandItem value="_create">
                  {isValidNewKey ? (
                    <button
                      onClick={handleCreateKey}
                      className="h-8 w-full text-left hover:cursor-pointer hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!!existingKeyMatch}>
                      + Add {searchValue}
                    </button>
                  ) : (
                    <div className="flex flex-col py-1 text-xs text-slate-500">
                      <span className="text-red-500">
                        {t("environments.contacts.attribute_key_safe_identifier_required")}
                      </span>
                    </div>
                  )}
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

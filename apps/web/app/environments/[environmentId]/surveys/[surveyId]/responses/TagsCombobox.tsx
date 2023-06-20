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
import { useMemo } from "react";

interface ITagsComboboxProps {
  tags: Tag[];
  currentTags: Tag[];
  addTag: (tagName: string) => void;
  createTag?: (tagName: string) => void;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
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
  setValue,
  value,
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="darkCTA">+ Add Tag</Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-60 w-[200px] overflow-y-auto p-0">
        <Command>
          <div className="p-1">
            <CommandInput
              placeholder="Search Tags..."
              className="border-none border-transparent shadow-none outline-0 ring-offset-transparent focus:border-none focus:border-transparent focus:shadow-none focus:outline-0 focus:ring-offset-transparent"
              value={searchValue}
              onValueChange={(search) => setSearchValue(search)}
            />
          </div>
          <CommandEmpty>
            <a
              onClick={() => createTag?.(searchValue)}
              className="text-muted-foreground flex h-6 cursor-pointer items-center justify-center focus:!shadow-none focus:outline-none">
              + Add {searchValue}
            </a>
          </CommandEmpty>
          <CommandGroup>
            {tagsToSearch?.length === 0 ? <CommandItem>No tags found</CommandItem> : null}

            {tagsToSearch?.map((tag) => (
              <CommandItem
                key={tag.value}
                onSelect={(currentValue) => {
                  setValue(currentValue === value ? "" : currentValue);
                  setOpen(false);
                  addTag(currentValue);
                }}>
                {tag.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default TagsCombobox;

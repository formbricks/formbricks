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
import { useState } from "react";

interface IMergeTagsComboboxProps {
  tags: Tag[];
  onSelect: (tagId: string) => void;
}

type Tag = {
  label: string;
  value: string;
};

const MergeTagsCombobox: React.FC<IMergeTagsComboboxProps> = ({ tags, onSelect }) => {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="secondary"
          size="sm"
          className="font-medium text-slate-900 focus:border-transparent focus:shadow-transparent focus:outline-transparent focus:ring-0 focus:ring-transparent">
          Merge
        </Button>
      </PopoverTrigger>
      <PopoverContent className="max-h-60 w-[200px] overflow-y-auto p-0">
        <Command>
          <div className="p-1">
            <CommandInput
              placeholder="Search Tags..."
              className="border-none border-transparent shadow-none outline-0 ring-offset-transparent focus:border-none focus:border-transparent focus:shadow-none focus:outline-0 focus:ring-offset-transparent"
            />
          </div>
          <CommandEmpty>
            <div className="p-2 text-sm text-slate-500">No tag found</div>
          </CommandEmpty>
          <CommandGroup>
            {tags?.length === 0 ? <CommandItem>No tags found</CommandItem> : null}

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
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default MergeTagsCombobox;

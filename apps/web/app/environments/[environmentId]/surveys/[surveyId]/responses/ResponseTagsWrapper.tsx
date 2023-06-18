import { useResponses } from "@/lib/responses/responses";
import { useCreateTag } from "@/lib/tags/mutateTags";
import { cn } from "@formbricks/lib/cn";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@formbricks/ui";
import { Check, ChevronsUpDown } from "lucide-react";
import React from "react";
import { useState } from "react";

interface IResponseTagsWrapperProps {
  data: {
    tagId: string;
    tagName: string;
  }[];

  environmentId: string;
  surveyId: string;
  productId: string;
  responseId: string;
}

const frameworks = [
  {
    value: "next.js",
    label: "Next.js",
  },
  {
    value: "sveltekit",
    label: "SvelteKit",
  },
  {
    value: "nuxt.js",
    label: "Nuxt.js",
  },
  {
    value: "remix",
    label: "Remix",
  },
  {
    value: "astro",
    label: "Astro",
  },
];

export function ComboboxDemo() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* <Button variant="darkCTA" role="combobox" aria-expanded={open} className="w-[200px] justify-between">
          {value ? frameworks.find((framework) => framework.value === value)?.label : "Select framework..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button> */}

        <Button variant="darkCTA">+ Add Tag</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search framework..." />
          <CommandEmpty>No framework found.</CommandEmpty>
          <CommandGroup>
            {frameworks.map((framework) => (
              <CommandItem
                key={framework.value}
                onSelect={(currentValue) => {
                  setValue(currentValue === value ? "" : currentValue);
                  setOpen(false);
                }}>
                <Check
                  className={cn("mr-2 h-4 w-4", value === framework.value ? "opacity-100" : "opacity-0")}
                />
                {framework.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const ResponseTagsWrapper: React.FC<IResponseTagsWrapperProps> = ({
  data,
  environmentId,
  productId,
  responseId,
  surveyId,
}) => {
  const [newTagValue, setNewTagValue] = useState("");
  const { createTag, isCreatingTag } = useCreateTag(environmentId, surveyId, responseId);

  const { mutateResponses } = useResponses(environmentId, surveyId);

  return (
    <div className="flex items-center gap-3 p-6">
      <ComboboxDemo />
      <div className="flex items-center gap-2">
        {data.map((tag) => (
          <div
            key={tag.tagId}
            className="relative flex items-center justify-between rounded-lg border border-teal-500 bg-teal-300 px-2 py-1">
            <span className="text-sm">#{tag.tagName}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Input
          type="text"
          value={newTagValue}
          onChange={(e) => {
            setNewTagValue(e.target.value);
          }}
        />

        <Button
          variant="darkCTA"
          onClick={() =>
            createTag(
              { name: newTagValue, productId },
              {
                onSuccess: () => {
                  mutateResponses();
                  setNewTagValue("");
                },
              }
            )
          }
          loading={isCreatingTag}>
          <div className="flex items-center gap-1">
            <span>+</span>
            <span>Add</span>
          </div>
        </Button>
      </div>
    </div>
  );
};

export default ResponseTagsWrapper;

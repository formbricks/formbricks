import { addTagToResponse, useResponses } from "@/lib/responses/responses";
import { useCreateTag } from "@/lib/tags/mutateTags";
import { useTagsForProduct } from "@/lib/tags/tags";
import { cn } from "@formbricks/lib/cn";
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
import { Check } from "lucide-react";
import React from "react";
import { useMemo } from "react";
import { useState } from "react";

interface IResponseTagsWrapperProps {
  tags: {
    tagId: string;
    tagName: string;
  }[];

  environmentId: string;
  surveyId: string;
  productId: string;
  responseId: string;
}

export function ComboboxDemo({
  tags,
  currentTags,
  addTag,
}: {
  tags: { label: string; value: string }[];
  currentTags: { label: string; value: string }[];
  addTag: (tagName: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [searchValue, setSearchValue] = useState("");

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
        {/* <Button variant="darkCTA" role="combobox" aria-expanded={open} className="w-[200px] justify-between">
          {value ? frameworks.find((framework) => framework.value === value)?.label : "Select framework..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button> */}

        <Button variant="minimal">+ Add Tag</Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
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
            <div className="text-muted-foreground flex h-16 items-center justify-center">
              + Add {searchValue}
            </div>
          </CommandEmpty>
          <CommandGroup>
            {tagsToSearch?.map((tag) => (
              <CommandItem
                key={tag.value}
                onSelect={(currentValue) => {
                  setValue(currentValue === value ? "" : currentValue);
                  setOpen(false);
                  addTag(currentValue);
                }}>
                <Check className={cn("mr-2 h-4 w-4", value === tag.value ? "opacity-100" : "opacity-0")} />
                {tag.label}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const ResponseTagsWrapper: React.FC<IResponseTagsWrapperProps> = ({
  tags,
  environmentId,
  productId,
  responseId,
  surveyId,
}) => {
  const { createTag, isCreatingTag } = useCreateTag(environmentId, surveyId, responseId);

  const { mutateResponses } = useResponses(environmentId, surveyId);

  const { data: productTags } = useTagsForProduct(environmentId, productId);

  return (
    <div className="flex items-center gap-3 p-6">
      <div className="flex items-center gap-2">
        {tags.map((tag) => (
          <div
            key={tag.tagId}
            className="relative flex items-center justify-between rounded-lg border border-teal-500 bg-teal-300 px-2 py-1">
            <span className="text-sm">#{tag.tagName}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {/* <Input
          type="text"
          value={newTagValue}
          onChange={(e) => {
            setNewTagValue(e.target.value);
          }}
        /> */}

        {!!productTags ? (
          <ComboboxDemo
            tags={productTags?.map((tag) => ({ value: tag.name, label: tag.name }))}
            currentTags={tags.map((tag) => ({ value: tag.tagName, label: tag.tagName }))}
            addTag={
              (tagName) => {
                const res = addTagToResponse(
                  environmentId,
                  surveyId,
                  responseId,
                  productTags.find((tag) => tag.name === tagName)?.id ?? ""
                );
                // console.log({ res });

                mutateResponses();
              }
              // createTag(
              //   {
              //     name: tagName,
              //     productId,
              //   },
              //   {
              //     onSuccess: () => {
              //       mutateResponses();
              //     },
              //   }
              // )
            }
          />
        ) : null}

        {/* <Button
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
        </Button> */}
      </div>
    </div>
  );
};

export default ResponseTagsWrapper;

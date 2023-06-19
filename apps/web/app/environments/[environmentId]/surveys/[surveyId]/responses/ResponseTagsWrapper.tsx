import { removeTagFromResponse, useAddTagToResponse, useResponses } from "@/lib/responses/responses";
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
import { Check, Loader2 } from "lucide-react";
import React from "react";
import { useMemo } from "react";
import { useState } from "react";
import { XCircleIcon } from "@heroicons/react/24/solid";

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
  createTag,
  setValue,
  value,
  searchValue,
  setSearchValue,
  open,
  setOpen,
}: {
  tags: { label: string; value: string }[];
  currentTags: { label: string; value: string }[];
  addTag: (tagName: string) => void;
  createTag?: (tagName: string) => void;
  value: string;
  setValue: React.Dispatch<React.SetStateAction<string>>;
  searchValue: string;
  setSearchValue: React.Dispatch<React.SetStateAction<string>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
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

export function Tag({
  tagId,
  tagName,
  onDelete,
}: {
  tagId: string;
  tagName: string;
  onDelete: (tagId: string) => void;
}) {
  const [deleteButtonVisible, setDeleteButtonVisible] = useState(false);

  return (
    <div
      key={tagId}
      onMouseEnter={() => setDeleteButtonVisible(true)}
      onMouseLeave={() => setDeleteButtonVisible(false)}
      className="relative flex flex-col items-center justify-between rounded-lg border border-teal-500 bg-teal-300 px-2 py-1">
      <span className="text-sm">#{tagName}</span>
      {deleteButtonVisible ? (
        <span
          className="absolute -right-2 -top-2 cursor-pointer text-sm"
          onClick={() => {
            onDelete(tagId);
          }}>
          <XCircleIcon fontSize={24} className="h-4 w-4 text-slate-900" />
        </span>
      ) : null}
    </div>
  );
}

const ResponseTagsWrapper: React.FC<IResponseTagsWrapperProps> = ({
  tags,
  environmentId,
  productId,
  responseId,
  surveyId,
}) => {
  const [value, setValue] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = React.useState(false);

  const { createTag, isCreatingTag } = useCreateTag(environmentId, productId);

  const { mutateResponses } = useResponses(environmentId, surveyId);

  const { data: productTags, mutate: refetchProductTags } = useTagsForProduct(environmentId, productId);
  const { trigger: addTagToResponse, isMutating: isAdding } = useAddTagToResponse(
    environmentId,
    surveyId,
    responseId
  );

  const onDelete = async (tagId: string) => {
    try {
      await removeTagFromResponse(environmentId, surveyId, responseId, tagId);

      mutateResponses();
    } catch (e) {
      console.log(e);
    }
  };

  return (
    <div className="flex items-center gap-3 p-6">
      <div className="flex items-center gap-2">
        {tags.map((tag) => (
          <Tag onDelete={onDelete} tagId={tag.tagId} tagName={tag.tagName} />
        ))}

        {isAdding ? (
          <div className="relative">
            <div className="absolute inset-0 z-50 grid place-items-center bg-black bg-opacity-50">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>

            <div className="relative flex flex-col items-center justify-between rounded-lg border border-teal-500 bg-teal-300 px-2 py-1">
              <span className="text-sm">#{value}</span>
              <span className="absolute -right-2 -top-2 cursor-pointer text-sm">
                <XCircleIcon fontSize={24} className="h-4 w-4 text-slate-900" />
              </span>
            </div>
          </div>
        ) : null}

        {isCreatingTag ? (
          <div className="relative">
            <div className="absolute inset-0 z-50 grid place-items-center bg-black bg-opacity-50">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>

            <div className="relative flex flex-col items-center justify-between rounded-lg border border-teal-500 bg-teal-300 px-2 py-1">
              <span className="text-sm">#{searchValue}</span>

              <span className="absolute -right-2 -top-2 cursor-pointer text-sm">
                <XCircleIcon fontSize={24} className="h-4 w-4 text-slate-900" />
              </span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {!!productTags ? (
          <ComboboxDemo
            open={open}
            setOpen={setOpen}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            setValue={setValue}
            value={value}
            tags={productTags?.map((tag) => ({ value: tag.name, label: tag.name }))}
            currentTags={tags.map((tag) => ({ value: tag.tagName, label: tag.tagName }))}
            createTag={(tagName) => {
              createTag(
                {
                  name: tagName,
                  responseId,
                },
                {
                  onSuccess: () => {
                    setValue("");
                    setSearchValue("");
                    setOpen(false);
                    mutateResponses();

                    refetchProductTags();
                  },
                }
              );
            }}
            addTag={(tagName) => {
              addTagToResponse(
                {
                  tagIdToAdd: productTags.find((tag) => tag.name === tagName)?.id ?? "",
                },
                {
                  onSuccess: () => {
                    setValue("");
                    setSearchValue("");
                    setOpen(false);
                    mutateResponses();

                    refetchProductTags();
                  },
                }
              );
            }}
          />
        ) : null}
      </div>
    </div>
  );
};

export default ResponseTagsWrapper;

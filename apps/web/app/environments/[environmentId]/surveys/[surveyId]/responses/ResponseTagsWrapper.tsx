import { useResponses } from "@/lib/responses/responses";
import { removeTagFromResponse, useAddTagToResponse } from "@/lib/tags/mutateTags";
import { useCreateTag } from "@/lib/tags/mutateTags";
import { useTagsForProduct } from "@/lib/tags/tags";
import { PlusCircle } from "lucide-react";
import React from "react";
import { useState } from "react";
import { XCircleIcon } from "@heroicons/react/24/solid";
import TagsCombobox from "@/app/environments/[environmentId]/surveys/[surveyId]/responses/TagsCombobox";
import { toast } from "react-hot-toast";

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

export function Tag({
  tagId,
  tagName,
  onDelete,
  tags,
  setTagsState
}: {
  tagId: string;
  tagName: string;
  onDelete: (tagId: string) => void;
  tags: IResponseTagsWrapperProps["tags"];
  setTagsState: (tags: IResponseTagsWrapperProps["tags"]) => void;
}) {
  return (
    <div
      key={tagId}
      className="relative flex items-center gap-2 justify-between rounded-full border text-slate-100 bg-slate-800 px-2 py-1"
    >
      <div className="flex items-center gap-2">
        <PlusCircle size={12} />
        <span className="text-sm">
          {tagName}
        </span>
      </div>

      <span
        className="cursor-pointer text-sm"
        onClick={() => {
          setTagsState(tags.filter((tag) => tag.tagId !== tagId));

          onDelete(tagId);
        }}>
        <XCircleIcon fontSize={24} className="h-4 w-4 text-slate-100 hover:text-slate-200" />
      </span>

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
  const [tagsState, setTagsState] = useState(tags)

  const { createTag } = useCreateTag(environmentId, productId);

  const { mutateResponses } = useResponses(environmentId, surveyId);

  const { data: productTags, mutate: refetchProductTags } = useTagsForProduct(environmentId, productId);

  const { addTagToRespone } = useAddTagToResponse(
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
    <div className="flex items-start gap-3 p-6">
      {
        tagsState?.length > 0 ? <div className="flex max-w-[60%] flex-wrap items-center gap-2">
          {tagsState.map((tag) => (
            <Tag key={tag.tagId} onDelete={onDelete} tagId={tag.tagId} tagName={tag.tagName}
              tags={tagsState} setTagsState={setTagsState}
            />
          ))}
        </div> : null
      }

      <div className="flex items-center gap-2">
        {!!productTags ? (
          <TagsCombobox
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
                },
                {
                  onSuccess: (data) => {
                    setTagsState((prevTags) => [
                      ...prevTags,
                      {
                        tagId: data.id,
                        tagName: data.name
                      }
                    ])
                    setValue(data.name);
                    addTagToRespone(
                      {
                        tagIdToAdd: data.id,
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
                  },
                  onError:(err) => {
                    toast.error(err?.message ?? "Something went wrong")

                    setValue("");
                    setSearchValue("");
                    setOpen(false);
                    mutateResponses();

                    refetchProductTags();
                  }
                }
              );
            }}
            addTag={(tagName) => {
              setTagsState((prevTags) => [
                ...prevTags,
                {
                  tagId: productTags.find((tag) => tag.name === tagName)?.id ?? "",
                  tagName,
                }
              ])

              addTagToRespone(
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

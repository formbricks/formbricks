"use client";

import { AlertCircleIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";

import { TTag } from "@formbricks/types/tags";

import { Button } from "../../Button";
import { Tag } from "../../Tag";
import TagsCombobox from "../../TagsCombobox";
import { createTagAction, createTagToResponeAction, deleteTagOnResponseAction } from "../actions";

interface ResponseTagsWrapperProps {
  tags: {
    tagId: string;
    tagName: string;
  }[];
  environmentId: string;
  responseId: string;
  environmentTags: TTag[];
  updateFetchedResponses: () => void;
}

const ResponseTagsWrapper: React.FC<ResponseTagsWrapperProps> = ({
  tags,
  environmentId,
  responseId,
  environmentTags,
  updateFetchedResponses,
}) => {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = React.useState(false);
  const [tagsState, setTagsState] = useState(tags);
  const [tagIdToHighlight, setTagIdToHighlight] = useState("");

  const onDelete = async (tagId: string) => {
    try {
      await deleteTagOnResponseAction(responseId, tagId);
      updateFetchedResponses();
    } catch (e) {
      toast.error("An error occurred deleting the tag");
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (tagIdToHighlight) {
        setTagIdToHighlight("");
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [tagIdToHighlight]);

  return (
    <div className="flex items-center gap-3 p-6">
      <Button
        variant="minimal"
        size="sm"
        className="cursor-pointer p-0"
        onClick={() => {
          router.push(`/environments/${environmentId}/settings/tags`);
        }}>
        <SettingsIcon className="h-5 w-5 text-slate-300 hover:text-slate-400" />
      </Button>
      <div className="flex flex-wrap items-center gap-2">
        {tagsState?.map((tag) => (
          <Tag
            key={tag.tagId}
            onDelete={onDelete}
            tagId={tag.tagId}
            tagName={tag.tagName}
            tags={tagsState}
            setTagsState={setTagsState}
            highlight={tagIdToHighlight === tag.tagId}
          />
        ))}

        <TagsCombobox
          open={open}
          setOpen={setOpen}
          searchValue={searchValue}
          setSearchValue={setSearchValue}
          tags={environmentTags?.map((tag) => ({ value: tag.id, label: tag.name })) ?? []}
          currentTags={tagsState.map((tag) => ({ value: tag.tagId, label: tag.tagName }))}
          createTag={async (tagName) => {
            await createTagAction(environmentId, tagName?.trim() ?? "")
              .then((tag) => {
                setTagsState((prevTags) => [
                  ...prevTags,
                  {
                    tagId: tag.id,
                    tagName: tag.name,
                  },
                ]);
                createTagToResponeAction(responseId, tag.id).then(() => {
                  updateFetchedResponses();
                  setSearchValue("");
                  setOpen(false);
                });
              })
              .catch((err) => {
                if (err?.message.includes("Unique constraint failed on the fields")) {
                  toast.error("Tag already exists", {
                    duration: 2000,
                    icon: <AlertCircleIcon className="h-5 w-5 text-orange-500" />,
                  });
                } else {
                  toast.error(err?.message ?? "Something went wrong", {
                    duration: 2000,
                  });
                }

                setSearchValue("");
                setOpen(false);
              });
          }}
          addTag={(tagId) => {
            setTagsState((prevTags) => [
              ...prevTags,
              {
                tagId,
                tagName: environmentTags?.find((tag) => tag.id === tagId)?.name ?? "",
              },
            ]);

            createTagToResponeAction(responseId, tagId).then(() => {
              updateFetchedResponses();
              setSearchValue("");
              setOpen(false);
            });
          }}
        />
      </div>
    </div>
  );
};

export default ResponseTagsWrapper;

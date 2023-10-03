"use client";

import TagsCombobox from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/components/TagsCombobox";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Tag } from "./Tag";
import { ExclamationCircleIcon, Cog6ToothIcon } from "@heroicons/react/24/solid";
import { useRouter } from "next/navigation";
import { Button } from "@formbricks/ui";
import { TTag } from "@formbricks/types/v1/tags";
import {
  createTagToResponeAction,
  createTagAction,
  deleteTagOnResponseAction,
} from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/responses/actions";

interface ResponseTagsWrapperProps {
  tags: {
    tagId: string;
    tagName: string;
  }[];
  environmentId: string;
  responseId: string;
  environmentTags: TTag[];
}

const ResponseTagsWrapper: React.FC<ResponseTagsWrapperProps> = ({
  tags,
  environmentId,
  responseId,
  environmentTags,
}) => {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = React.useState(false);
  const [tagsState, setTagsState] = useState(tags);
  const [tagIdToHighlight, setTagIdToHighlight] = useState("");

  const onDelete = async (tagId: string) => {
    try {
      await deleteTagOnResponseAction(responseId, tagId);

      router.refresh();
    } catch (e) {
      toast.error("An error occurred deleting the tag");
      router.refresh();
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
    <div className="flex items-center justify-between gap-3 p-6">
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
                  setSearchValue("");
                  setOpen(false);
                  router.refresh();
                });
              })
              .catch((err) => {
                if (err?.message.includes("Unique constraint failed on the fields")) {
                  toast.error("Tag already exists", {
                    duration: 2000,
                    icon: <ExclamationCircleIcon className="h-5 w-5 text-orange-500" />,
                  });
                } else {
                  toast.error(err?.message ?? "Something went wrong", {
                    duration: 2000,
                  });
                }

                setSearchValue("");
                setOpen(false);
                router.refresh();
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
              setSearchValue("");
              setOpen(false);
              router.refresh();
            });
          }}
        />
      </div>

      <Button
        variant="minimal"
        size="sm"
        className="cursor-pointer p-0"
        onClick={() => {
          router.push(`/environments/${environmentId}/settings/tags`);
        }}>
        <Cog6ToothIcon className="h-5 w-5 text-slate-300 hover:text-slate-400" />
      </Button>
    </div>
  );
};

export default ResponseTagsWrapper;

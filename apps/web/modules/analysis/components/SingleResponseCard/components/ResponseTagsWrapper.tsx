"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Button } from "@/modules/ui/components/button";
import { Tag } from "@/modules/ui/components/tag";
import { TagsCombobox } from "@/modules/ui/components/tags-combobox";
import { useTranslate } from "@tolgee/react";
import { AlertCircleIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { TTag } from "@formbricks/types/tags";
import { createTagAction, createTagToResponseAction, deleteTagOnResponseAction } from "../actions";

interface ResponseTagsWrapperProps {
  tags: {
    tagId: string;
    tagName: string;
  }[];
  environmentId: string;
  responseId: string;
  environmentTags: TTag[];
  updateFetchedResponses: () => void;
  isReadOnly?: boolean;
}

export const ResponseTagsWrapper: React.FC<ResponseTagsWrapperProps> = ({
  tags,
  environmentId,
  responseId,
  environmentTags,
  updateFetchedResponses,
  isReadOnly,
}) => {
  const { t } = useTranslate();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = React.useState(false);
  const [tagsState, setTagsState] = useState(tags);
  const [tagIdToHighlight, setTagIdToHighlight] = useState("");

  const onDelete = async (tagId: string) => {
    try {
      await deleteTagOnResponseAction({ responseId, tagId });
      updateFetchedResponses();
    } catch (e) {
      toast.error(t("environments.surveys.responses.an_error_occurred_deleting_the_tag"));
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
    <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4">
      {!isReadOnly && (
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer p-0"
          onClick={() => {
            router.push(`/environments/${environmentId}/project/tags`);
          }}>
          <SettingsIcon className="h-5 w-5 text-slate-500 hover:text-slate-600" />
        </Button>
      )}
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
            allowDelete={!isReadOnly}
          />
        ))}

        {!isReadOnly && (
          <TagsCombobox
            open={open}
            setOpen={setOpen}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            tags={environmentTags?.map((tag) => ({ value: tag.id, label: tag.name })) ?? []}
            currentTags={tagsState.map((tag) => ({ value: tag.tagId, label: tag.tagName }))}
            createTag={async (tagName) => {
              setOpen(false);

              const createTagResponse = await createTagAction({
                environmentId,
                tagName: tagName?.trim() ?? "",
              });
              if (createTagResponse?.data) {
                setTagsState((prevTags) => [
                  ...prevTags,
                  {
                    tagId: createTagResponse.data?.id ?? "",
                    tagName: createTagResponse.data?.name ?? "",
                  },
                ]);
                const createTagToResponseActionResponse = await createTagToResponseAction({
                  responseId,
                  tagId: createTagResponse.data.id,
                });

                if (createTagToResponseActionResponse?.data) {
                  updateFetchedResponses();
                  setSearchValue("");
                }
              } else {
                const errorMessage = getFormattedErrorMessage(createTagResponse);
                if (errorMessage.includes("Unique constraint failed on the fields")) {
                  toast.error(t("environments.surveys.responses.tag_already_exists"), {
                    duration: 2000,
                    icon: <AlertCircleIcon className="h-5 w-5 text-orange-500" />,
                  });
                } else {
                  toast.error(errorMessage ?? t("common.something_went_wrong_please_try_again"), {
                    duration: 2000,
                  });
                }

                setSearchValue("");
              }
            }}
            addTag={(tagId) => {
              setTagsState((prevTags) => [
                ...prevTags,
                {
                  tagId,
                  tagName: environmentTags?.find((tag) => tag.id === tagId)?.name ?? "",
                },
              ]);

              createTagToResponseAction({ responseId, tagId }).then(() => {
                updateFetchedResponses();
                setSearchValue("");
                setOpen(false);
              });
            }}
          />
        )}
      </div>
    </div>
  );
};

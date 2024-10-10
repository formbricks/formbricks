"use client";

import { AlertCircleIcon, SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { TTag } from "@formbricks/types/tags";
import { Button } from "../../Button";
import { Tag } from "../../Tag";
import { TagsCombobox } from "../../TagsCombobox";
import { createTagAction, createTagToSurveyAction, deleteTagOnSurveyAction } from "../actions";

interface SurveyTagsWrapperProps {
  tags: {
    tagId: string;
    tagName: string;
  }[];
  environmentId: string;
  surveyId: string;
  environmentTags: TTag[];
  updateFetchedSurveys: () => void;
  isViewer?: boolean;
}

export const SurveyTagsWrapper: React.FC<SurveyTagsWrapperProps> = ({
  tags,
  environmentId,
  surveyId,
  environmentTags,
  updateFetchedSurveys,
  isViewer,
}) => {
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = React.useState(false);
  const [tagsState, setTagsState] = useState(tags);
  const [tagIdToHighlight, setTagIdToHighlight] = useState("");

  const onDelete = async (tagId: string) => {
    try {
      await deleteTagOnSurveyAction({ surveyId, tagId });
      updateFetchedSurveys();
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
    <div className="flex items-center gap-3 border-t border-slate-200 px-6 py-4">
      {!isViewer && (
        <Button
          variant="minimal"
          size="sm"
          className="cursor-pointer p-0"
          onClick={() => {
            router.push(`/environments/${environmentId}/product/tags`);
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
            allowDelete={!isViewer}
          />
        ))}

        {!isViewer && (
          <TagsCombobox
            open={open}
            setOpen={setOpen}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            tags={environmentTags?.map((tag) => ({ value: tag.id, label: tag.name })) ?? []}
            currentTags={tagsState.map((tag) => ({ value: tag.tagId, label: tag.tagName }))}
            createTag={async (tagName) => {
              setOpen(false);

              const createTagSurvey = await createTagAction({
                environmentId,
                tagName: tagName?.trim() ?? "",
              });

              if (createTagSurvey?.data) {
                setTagsState((prevTags) => [
                  ...prevTags,
                  {
                    tagId: createTagSurvey.data?.id ?? "",
                    tagName: createTagSurvey.data?.name ?? "",
                  },
                ]);
                const createTagToSurveyActionSurvey = await createTagToSurveyAction({
                  surveyId,
                  tagId: createTagSurvey.data.id,
                });

                if (createTagToSurveyActionSurvey?.data) {
                  updateFetchedSurveys();
                  setSearchValue("");
                } else {
                  toast.error("create tag to survey action failed", {
                    duration: 2000,
                  });
                }
              } else {
                const errorMessage = getFormattedErrorMessage(createTagSurvey);
                if (errorMessage.includes("Unique constraint failed on the fields")) {
                  toast.error("Tag already exists", {
                    duration: 2000,
                    icon: <AlertCircleIcon className="h-5 w-5 text-orange-500" />,
                  });
                } else {
                  toast.error(errorMessage ?? "Something went wrong", {
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

              createTagToSurveyAction({ surveyId, tagId }).then(() => {
                updateFetchedSurveys();
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

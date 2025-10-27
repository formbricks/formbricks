"use client";

import { SettingsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { TTag } from "@formbricks/types/tags";
import { TagError } from "@/modules/projects/settings/types/tag";
import { Button } from "@/modules/ui/components/button";
import { Tag } from "@/modules/ui/components/tag";
import { TagsCombobox } from "@/modules/ui/components/tags-combobox";
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
  const { t } = useTranslation();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = React.useState(false);
  const [tagsState, setTagsState] = useState(tags);
  const [tagIdToHighlight, setTagIdToHighlight] = useState("");
  const [isLoadingTagOperation, setIsLoadingTagOperation] = useState(false);

  const onDelete = async (tagId: string) => {
    try {
      setIsLoadingTagOperation(true);
      await deleteTagOnResponseAction({ responseId, tagId });
      updateFetchedResponses();
    } catch (e) {
      toast.error(t("environments.surveys.responses.an_error_occurred_deleting_the_tag"));
      console.error("Error deleting tag:", e);
    } finally {
      setIsLoadingTagOperation(false);
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

  const handleCreateTag = async (tagName: string) => {
    setIsLoadingTagOperation(true);
    try {
      const newTagResponse = await createTagAction({ environmentId, tagName });

      if (!newTagResponse?.data) {
        toast.error(t("environments.surveys.responses.an_error_occurred_creating_the_tag"));
        return;
      }

      if (!newTagResponse.data.ok) {
        const errorMessage = newTagResponse.data.error;
        if (errorMessage?.code === TagError.TAG_NAME_ALREADY_EXISTS) {
          toast.error(t("environments.surveys.responses.tag_already_exists"), {
            duration: 2000,
            icon: <SettingsIcon className="h-5 w-5 text-orange-500" />,
          });
        } else {
          toast.error(t("environments.surveys.responses.an_error_occurred_creating_the_tag"));
        }
        return;
      }

      const newTag = newTagResponse.data.data;
      await createTagToResponseAction({ responseId, tagId: newTag.id });

      setTagsState((prevTags) => [...prevTags, { tagId: newTag.id, tagName: newTag.name }]);
      setTagIdToHighlight(newTag.id);
      updateFetchedResponses();
      setSearchValue("");
      setOpen(false);
    } catch (error) {
      toast.error(t("environments.surveys.responses.an_error_occurred_creating_the_tag"));
      console.error("Error creating tag:", error);
    } finally {
      setIsLoadingTagOperation(false);
    }
  };

  const handleAddTag = async (tagId: string) => {
    setIsLoadingTagOperation(true);
    setTagsState((prevTags) => [
      ...prevTags,
      {
        tagId,
        tagName: environmentTags?.find((tag) => tag.id === tagId)?.name ?? "",
      },
    ]);

    try {
      await createTagToResponseAction({ responseId, tagId });
      updateFetchedResponses();
      setSearchValue("");
      setOpen(false);
    } catch (error) {
      toast.error(t("environments.surveys.responses.an_error_occurred_adding_the_tag"));
      console.error("Error adding tag:", error);
      // Revert the tag if the action failed
      setTagsState((prevTags) => prevTags.filter((tag) => tag.tagId !== tagId));
    } finally {
      setIsLoadingTagOperation(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 border-t border-slate-200 px-6 py-3">
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
            allowDelete={!isReadOnly && !isLoadingTagOperation}
          />
        ))}

        {!isReadOnly && (
          <TagsCombobox
            open={open && !isLoadingTagOperation}
            setOpen={setOpen}
            searchValue={searchValue}
            setSearchValue={setSearchValue}
            tags={environmentTags?.map((tag) => ({ value: tag.id, label: tag.name })) ?? []}
            currentTags={tagsState.map((tag) => ({ value: tag.tagId, label: tag.tagName }))}
            createTag={handleCreateTag}
            addTag={handleAddTag}
          />
        )}
      </div>

      {!isReadOnly && (
        <Button
          variant="ghost"
          size="sm"
          className="flex-shrink-0"
          onClick={() => {
            router.push(`/environments/${environmentId}/project/tags`);
          }}>
          <SettingsIcon className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

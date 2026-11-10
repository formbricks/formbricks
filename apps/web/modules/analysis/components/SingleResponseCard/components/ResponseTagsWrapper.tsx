"use client";

import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { logger } from "@formbricks/logger";
import { TResponse } from "@formbricks/types/responses";
import { TTag } from "@formbricks/types/tags";
import { TUserLocale } from "@formbricks/types/user";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import { IdBadge } from "@/modules/ui/components/id-badge";
import { Tag } from "@/modules/ui/components/tag";
import { TagsCombobox } from "@/modules/ui/components/tags-combobox";
import { addResponseTag, createTag, removeResponseTag } from "../lib/api-client";
import { SingleResponseCardMetadata } from "./SingleResponseCardMetadata";

interface ResponseTagsWrapperProps {
  readonly tags: {
    tagId: string;
    tagName: string;
  }[];
  readonly workspaceId: string;
  readonly responseId: string;
  readonly environmentTags: Pick<TTag, "id" | "name">[];
  readonly updateFetchedResponses: () => void;
  readonly isReadOnly?: boolean;
  readonly response: TResponse;
  readonly locale: TUserLocale;
}

export const ResponseTagsWrapper: React.FC<ResponseTagsWrapperProps> = ({
  tags,
  workspaceId,
  responseId,
  environmentTags,
  updateFetchedResponses,
  isReadOnly,
  response,
  locale,
}) => {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [open, setOpen] = React.useState(false);
  const [tagsState, setTagsState] = useState(tags);
  const [tagIdToHighlight, setTagIdToHighlight] = useState("");
  const [isLoadingTagOperation, setIsLoadingTagOperation] = useState(false);

  const onDelete = async (tagId: string) => {
    setIsLoadingTagOperation(true);
    try {
      await removeResponseTag(responseId, tagId);
      updateFetchedResponses();
    } catch (error) {
      const errorMessage = getV3ApiErrorMessage(error, "");
      logger.error({ errorMessage }, "Error deleting tag");
      toast.error(t("workspace.surveys.responses.an_error_occurred_deleting_the_tag"));
    }
    setIsLoadingTagOperation(false);
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
    let newTag: { id: string; name: string };
    try {
      newTag = await createTag(workspaceId, tagName);
    } catch (error) {
      // A 409 is the one refusal the tag picker words itself: the workspace already has this name.
      if (error instanceof V3ApiError && error.status === 409) {
        toast.error(t("workspace.surveys.responses.tag_already_exists"), {
          duration: 2000,
        });
      } else {
        toast.error(t("workspace.surveys.responses.an_error_occurred_creating_the_tag"));
      }
      return;
    }

    try {
      await addResponseTag(responseId, newTag.id);
      setTagsState((prevTags) => [...prevTags, { tagId: newTag.id, tagName: newTag.name }]);
      setTagIdToHighlight(newTag.id);
      updateFetchedResponses();
      setSearchValue("");
      setOpen(false);
    } catch (error) {
      const errorMessage = getV3ApiErrorMessage(error, t("common.something_went_wrong_please_try_again"));
      logger.error({ errorMessage });
      toast.error(errorMessage);
    }
    setIsLoadingTagOperation(false);
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
      await addResponseTag(responseId, tagId);
      updateFetchedResponses();
      setSearchValue("");
      setOpen(false);
    } catch (error) {
      toast.error(t("workspace.surveys.responses.an_error_occurred_adding_the_tag"));
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
        <SingleResponseCardMetadata response={response} locale={locale} />
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
      <IdBadge id={responseId} />
    </div>
  );
};

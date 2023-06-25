"use client";

import MergeTagsCombobox from "@/app/environments/[environmentId]/settings/tags/MergeTagsCombobox";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useDeleteTag, useMergeTags, useUpdateTag } from "@/lib/tags/mutateTags";
import { useTagsCountForEnvironment, useTagsForEnvironment } from "@/lib/tags/tags";
import { cn } from "@formbricks/lib/cn";
import { Button, Input } from "@formbricks/ui";
import React from "react";
import { toast } from "react-hot-toast";

interface IEditTagsWrapperProps {
  environmentId: string;
}

const SingleTag: React.FC<{
  tagId: string;
  tagName: string;
  environmentId: string;
  tagCount?: number;
  tagCountLoading?: boolean;
  updateTagsCount?: () => void;
}> = ({
  environmentId,
  tagId,
  tagName,
  tagCount = 0,
  tagCountLoading = false,
  updateTagsCount = () => {},
}) => {
  const { mutate: refetchEnvironmentTags, data: environmentTags } = useTagsForEnvironment(environmentId);
  const { deleteTag, isDeletingTag } = useDeleteTag(environmentId, tagId);

  const { updateTag, updateTagError } = useUpdateTag(environmentId, tagId);
  const { mergeTags, isMergingTags } = useMergeTags(environmentId);

  return (
    <div className="w-full" key={tagId}>
      <div className="m-2 grid h-16 grid-cols-4 content-center rounded-lg">
        <div className="col-span-2 flex items-center text-sm">
          <div className="w-full text-left">
            <Input
              className={cn(
                "w-full border font-medium text-slate-900",
                updateTagError
                  ? "border-red-500 focus:border-red-500"
                  : "border-slate-200 focus:border-slate-500"
              )}
              defaultValue={tagName}
              onBlur={(e) => {
                updateTag(
                  { name: e.target.value.trim() },
                  {
                    onSuccess: () => {
                      toast.success("Tag updated");
                      refetchEnvironmentTags();
                    },
                    onError: (error) => {
                      toast.error(error?.message ?? "Failed to update tag");
                    },
                  }
                );
              }}
            />
          </div>
        </div>

        <div className="col-span-1 my-auto whitespace-nowrap text-center text-sm text-slate-500">
          <div className="text-slate-900">{tagCountLoading ? <LoadingSpinner /> : <p>{tagCount}</p>}</div>
        </div>

        <div className="col-span-1 my-auto flex items-center justify-end gap-4 whitespace-nowrap text-center text-sm text-slate-500">
          <div>
            {isMergingTags ? (
              <div className="w-24">
                <LoadingSpinner />
              </div>
            ) : (
              <MergeTagsCombobox
                tags={
                  environmentTags
                    ?.filter((tag) => tag.id !== tagId)
                    ?.map((tag) => ({ label: tag.name, value: tag.id })) ?? []
                }
                onSelect={(newTagId) => {
                  mergeTags(
                    {
                      originalTagId: tagId,
                      newTagId,
                    },
                    {
                      onSuccess: () => {
                        toast.success("Tags merged");
                        refetchEnvironmentTags();
                        updateTagsCount();
                      },
                    }
                  );
                }}
              />
            )}
          </div>

          <div>
            <Button
              variant="alert"
              size="sm"
              loading={isDeletingTag}
              className="font-medium text-slate-50 focus:border-transparent focus:shadow-transparent focus:outline-transparent focus:ring-0 focus:ring-transparent"
              onClick={() => {
                if (confirm("Are you sure you want to delete this tag?")) {
                  deleteTag(null, {
                    onSuccess: () => {
                      toast.success("Tag deleted");
                      refetchEnvironmentTags();
                      updateTagsCount();
                    },
                  });
                }
              }}>
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditTagsWrapper: React.FC<IEditTagsWrapperProps> = (props) => {
  const { environmentId } = props;
  const { data: environmentTags, isLoading: isLoadingEnvironmentTags } = useTagsForEnvironment(environmentId);

  const { tagsCount, isLoadingTagsCount, mutateTagsCount } = useTagsCountForEnvironment(environmentId);

  if (isLoadingEnvironmentTags) {
    return (
      <div className="text-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-4 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-2 pl-6">Name</div>
          <div className="col-span-1 text-center">Count</div>
          <div className="col-span-1 mr-4 flex justify-center text-center">Actions</div>
        </div>

        {!environmentTags?.length ? (
          <EmptySpaceFiller environmentId={environmentId} type="tag" noWidgetRequired />
        ) : null}

        {environmentTags?.map((tag) => (
          <SingleTag
            key={tag.id}
            environmentId={environmentId}
            tagId={tag.id}
            tagName={tag.name}
            tagCount={tagsCount?.find((count) => count.tagId === tag.id)?.count ?? 0}
            tagCountLoading={isLoadingTagsCount}
            updateTagsCount={mutateTagsCount}
          />
        ))}
      </div>
    </div>
  );
};

export default EditTagsWrapper;

"use client";

import MergeTagsCombobox from "@/app/(app)/environments/[environmentId]/settings/tags/MergeTagsCombobox";
import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { cn } from "@formbricks/lib/cn";
import { TEnvironment } from "@formbricks/types/v1/environment";
import { TTag, TTagsCount } from "@formbricks/types/v1/tags";
import { Button, Input } from "@formbricks/ui";
import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  deleteTagAction,
  mergeTagsAction,
  updateTagNameAction,
} from "@/app/(app)/environments/[environmentId]/settings/tags/actions";
import { ExclamationCircleIcon } from "@heroicons/react/24/solid";

interface IEditTagsWrapperProps {
  environment: TEnvironment;
  environmentTags: TTag[];
  environmentTagsCount: TTagsCount;
}

const SingleTag: React.FC<{
  tagId: string;
  tagName: string;
  tagCount?: number;
  tagCountLoading?: boolean;
  updateTagsCount?: () => void;
  environmentTags: TTag[];
}> = ({
  tagId,
  tagName,
  tagCount = 0,
  tagCountLoading = false,
  updateTagsCount = () => {},
  environmentTags,
}) => {
  const router = useRouter();
  // const { updateTag, updateTagError } = useUpdateTag(environment.id, tagId);
  // const { mergeTags, isMergingTags } = useMergeTags(environment.id);
  const [updateTagError, setUpdateTagError] = useState(false);
  const [isMergingTags, setIsMergingTags] = useState(false);

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
                updateTagNameAction(tagId, e.target.value.trim())
                  .then(() => {
                    setUpdateTagError(false);
                    toast.success("Tag updated");
                  })
                  .catch((error) => {
                    if (error?.message.includes("Unique constraint failed on the fields")) {
                      toast.error("Tag already exists", {
                        duration: 2000,
                        icon: <ExclamationCircleIcon className="h-5 w-5 text-orange-500" />,
                      });
                    } else {
                      toast.error(error?.message ?? "Something went wrong", {
                        duration: 2000,
                      });
                    }
                    setUpdateTagError(true);
                  });
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
                  setIsMergingTags(true);
                  mergeTagsAction(tagId, newTagId)
                    .then(() => {
                      toast.success("Tags merged");
                      updateTagsCount();
                      router.refresh();
                    })
                    .catch((error) => {
                      toast.error(error?.message ?? "Something went wrong");
                    })
                    .finally(() => {
                      setIsMergingTags(false);
                    });
                }}
              />
            )}
          </div>

          <div>
            <Button
              variant="alert"
              size="sm"
              // loading={isDeletingTag}
              className="font-medium text-slate-50 focus:border-transparent focus:shadow-transparent focus:outline-transparent focus:ring-0 focus:ring-transparent"
              onClick={() => {
                if (confirm("Are you sure you want to delete this tag?")) {
                  deleteTagAction(tagId).then(() => {
                    toast.success("Tag deleted");
                    updateTagsCount();
                    router.refresh();
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
  const { environment, environmentTags, environmentTagsCount } = props;
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="rounded-lg border border-slate-200">
        <div className="grid h-12 grid-cols-4 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
          <div className="col-span-2 pl-6">Name</div>
          <div className="col-span-1 text-center">Count</div>
          <div className="col-span-1 mr-4 flex justify-center text-center">Actions</div>
        </div>

        {!environmentTags?.length ? (
          <EmptySpaceFiller environment={environment} type="tag" noWidgetRequired />
        ) : null}

        {environmentTags?.map((tag) => (
          <SingleTag
            key={tag.id}
            tagId={tag.id}
            tagName={tag.name}
            tagCount={environmentTagsCount?.find((count) => count.tagId === tag.id)?.count ?? 0}
            environmentTags={environmentTags}
          />
        ))}
      </div>
    </div>
  );
};

export default EditTagsWrapper;

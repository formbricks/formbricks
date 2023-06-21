"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { useDeleteTag, useMergeTags, useUpdateTag } from "@/lib/tags/mutateTags";
import { useTagsCountForProduct, useTagsForProduct } from "@/lib/tags/tags";
import { Button, Input } from "@formbricks/ui";
import React from "react";
import debounce from "lodash.debounce";
import { useMemo } from "react";
import { toast } from "react-hot-toast";
import MergeTagsCombobox from "@/app/environments/[environmentId]/settings/tags/MergeTagsCombobox";
import { TagIcon } from "@heroicons/react/24/solid";

interface IEditTagsWrapperProps {
  environmentId: string;
}

const SingleTag: React.FC<{
  tagId: string;
  tagName: string;
  environmentId: string;
  productId: string;
  tagCount?: number;
  tagCountLoading?: boolean
  updateTagsCount?: () => void
}> = ({ environmentId, productId, tagId, tagName, tagCount = 0, tagCountLoading = false, updateTagsCount = () => { } }) => {
  const { mutate: refetchProductTags, data: productTags } = useTagsForProduct(environmentId, productId);
  const { deleteTag, isDeletingTag } = useDeleteTag(environmentId, productId, tagId);

  const { updateTag } = useUpdateTag(environmentId, productId, tagId);
  const { mergeTags, isMergingTags } = useMergeTags(environmentId, productId)

  const debouncedChangeHandler = useMemo(
    () =>
      debounce(
        (name: string) =>
          updateTag(
            { name },
            {
              onSuccess: () => {
                toast.success("Tag updated");
                refetchProductTags()
              },
            }
          ),
        1000
      ),
    [refetchProductTags, updateTag]
  );

  return <div
    className="w-full"
    key={tagId}>
    <div className="m-2 grid h-16 grid-cols-5 content-center rounded-lg">
      <div className="col-span-2 flex items-center text-sm">
        <div className="flex items-center">
          <div className="text-left">
            <Input
              className="font-medium text-slate-900 border-transparent hover:border-slate-200"
              defaultValue={tagName}
              onChange={(e) => {
                debouncedChangeHandler(e.target.value);
              }}
            />
          </div>
        </div>
      </div>

      <div className="col-span-1 my-auto whitespace-nowrap text-center text-sm text-slate-500">
        <div className="text-slate-900">
          {tagCountLoading ? <LoadingSpinner /> : <p>{tagCount} tags</p>}
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-center my-auto whitespace-nowrap text-center text-sm text-slate-500">
        <div>
          {
            isMergingTags ?
              <div className="w-24"><LoadingSpinner /></div>
              : <MergeTagsCombobox
                tags={
                  productTags?.filter(tag => tag.id !== tagId)?.map(
                    tag => ({ label: tag.name, value: tag.id })
                  ) ?? []
                }
                onSelect={
                  (newTagId) => {
                    mergeTags(
                      {
                        originalTagId: tagId,
                        newTagId
                      },
                      {
                        onSuccess: () => {
                          toast.success("Tags merged");
                          refetchProductTags();
                          updateTagsCount();
                        },
                      }
                    )
                  }
                }
              />
          }
        </div>

        <div>
          <Button variant="minimal" loading={isDeletingTag} className="focus:shadow-transparent focus:outline-transparent focus:border-transparent focus:ring-0 focus:ring-transparent font-medium text-slate-900"
            onClick={() => {
              deleteTag(
                null,
                {
                  onSuccess: () => {
                    toast.success("Tag deleted");
                    refetchProductTags();
                    updateTagsCount();
                  },
                }
              )
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  </div>

};

const EditTagsWrapper: React.FC<IEditTagsWrapperProps> = (props) => {
  const { environmentId } = props;
  const { product } = useProduct(environmentId);
  const { data: productTags, isLoading: isLoadingProductTags } = useTagsForProduct(
    environmentId,
    product?.id
  );

  const { tagsCount, isLoadingTagsCount, mutateTagsCount } = useTagsCountForProduct(environmentId, product?.id);

  if (isLoadingProductTags) {
    return (
      <div className="text-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {productTags?.length === 0 ? <EmptySpaceFiller type="response" environmentId={environmentId} /> : null}

      <div className="rounded-lg border border-slate-200">
        {
          !!productTags?.length ?
          <div className="grid h-12 grid-cols-5 content-center rounded-lg bg-slate-100 text-left text-sm font-semibold text-slate-900">
            <div className="col-span-2 pl-6">Name</div>
            <div className="text-center col-span-1">Count</div>
            <div className="text-center col-span-2">Actions</div>
          </div>
          : null
        }

        {productTags?.map((tag) => (
          <SingleTag
            key={tag.id}
            environmentId={environmentId}
            productId={product?.id}
            tagId={tag.id}
            tagName={tag.name}
            tagCount={
              tagsCount?.find((count) => count.tagId === tag.id)?.count ?? 0
            }
            tagCountLoading={isLoadingTagsCount}
            updateTagsCount={mutateTagsCount}
          />
        ))}
      </div>
    </div>
  );
};

export default EditTagsWrapper;

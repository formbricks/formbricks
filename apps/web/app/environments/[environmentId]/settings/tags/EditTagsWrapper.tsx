"use client";

import EmptySpaceFiller from "@/components/shared/EmptySpaceFiller";
import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { useDeleteTag, useUpdateTag } from "@/lib/tags/mutateTags";
import { useTagsCountForProduct, useTagsForProduct } from "@/lib/tags/tags";
import { Button, Input } from "@formbricks/ui";
import React from "react";
import debounce from "lodash.debounce";
import { useMemo } from "react";
import { toast } from "react-hot-toast";

interface IEditTagsWrapperProps {
  environmentId: string;
}

const SingleTag: React.FC<{
  tagId: string;
  tagName: string;
  environmentId: string;
  productId: string;
  tagCount?: number;
}> = ({ environmentId, productId, tagId, tagName, tagCount = 0 }) => {
  const { mutate: refetchProductTags } = useTagsForProduct(environmentId, productId);
  const { deleteTag, isDeletingTag } = useDeleteTag(environmentId, productId, tagId);

  const { updateTag } = useUpdateTag(environmentId, productId, tagId);

  const debouncedChangeHandler = useMemo(
    () =>
      debounce(
        (name: string) =>
          updateTag(
            { name },
            {
              onSuccess: () => {
                toast.success("Tag updated");
              },
            }
          ),
        1000
      ),
    [updateTag]
  );

  return (
    <div key={tagId} className="flex items-center justify-between">
      <div>
        <Input
          defaultValue={tagName}
          onChange={(e) => {
            // updateTag({ name: e.target.value }, { onSuccess: () => refetchProductTags() });
            debouncedChangeHandler(e.target.value);
          }}
          className="w-72 border-transparent hover:border-slate-200"
        />
      </div>

      <div className="text-sm text-slate-500">{tagCount} tags</div>

      <div className="flex items-center gap-2">
        <div>
          <Button
            variant="minimal"
        >
            Merge
          </Button>
        </div>

        <div>
          <Button variant="warn" loading={isDeletingTag}>
            <span
              className="text-sm"
              onClick={() => {
                deleteTag(null, {
                  onSuccess: () => {
                    refetchProductTags();
                  },
                });
              }}>
              Delete
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
};

const EditTagsWrapper: React.FC<IEditTagsWrapperProps> = (props) => {
  const { environmentId } = props;
  const { product } = useProduct(environmentId);
  const { data: productTags, isLoading: isLoadingProductTags } = useTagsForProduct(
    environmentId,
    product?.id
  );

  const {tagsCount} = useTagsCountForProduct(environmentId, product?.id);

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
        />
      ))}
    </div>
  );
};

export default EditTagsWrapper;

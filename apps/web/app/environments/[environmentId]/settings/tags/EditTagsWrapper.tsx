"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { useProduct } from "@/lib/products/products";
import { useDeleteTag } from "@/lib/tags/mutateTags";
import { useTagsForProduct } from "@/lib/tags/tags";
import { Button } from "@formbricks/ui";
import React from "react";

interface IEditTagsWrapperProps {
  environmentId: string;
}

const SingleTag: React.FC<{
  tagId: string;
  tagName: string;
  environmentId: string;
  productId: string;
}> = ({ environmentId, productId, tagId, tagName }) => {
  const { mutate: refetchProductTags } = useTagsForProduct(environmentId, productId);
  const { deleteTag, isDeletingTag } = useDeleteTag(environmentId, productId, tagId);

  return (
    <div key={tagId} className="flex items-center justify-between">
      <div>
        <p>{tagName}</p>
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
  );
};

const EditTagsWrapper: React.FC<IEditTagsWrapperProps> = (props) => {
  const { environmentId } = props;
  const { product } = useProduct(environmentId);
  const { data: productTags, isLoading: isLoadingProductTags } = useTagsForProduct(
    environmentId,
    product?.id
  );

  if (isLoadingProductTags) {
    return (
      <div className="text-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {productTags?.map((tag) => (
        <SingleTag
          key={tag.id}
          environmentId={environmentId}
          productId={product?.id}
          tagId={tag.id}
          tagName={tag.name}
        />
      ))}
    </div>
  );
};

export default EditTagsWrapper;

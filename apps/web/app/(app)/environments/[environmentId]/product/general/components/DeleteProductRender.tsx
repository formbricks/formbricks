"use client";

import { deleteProductAction } from "@/app/(app)/environments/[environmentId]/product/general/actions";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { truncate } from "@formbricks/lib/utils/strings";
import { TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { DeleteDialog } from "@formbricks/ui/DeleteDialog";

type DeleteProductRenderProps = {
  isDeleteDisabled: boolean;
  isUserAdminOrOwner: boolean;
  product: TProduct;
};

export const DeleteProductRender = ({
  isDeleteDisabled,
  isUserAdminOrOwner,
  product,
}: DeleteProductRenderProps) => {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const handleDeleteProduct = async () => {
    setIsDeleting(true);
    const deleteProductResponse = await deleteProductAction({ productId: product.id });
    if (deleteProductResponse?.data) {
      toast.success("Product deleted successfully.");
      router.push("/");
    } else {
      const errorMessage = getFormattedErrorMessage(deleteProductResponse);
      toast.error(errorMessage);
      setIsDeleteDialogOpen(false);
    }
    setIsDeleting(false);
  };

  return (
    <div>
      {!isDeleteDisabled && (
        <div>
          <p className="text-sm text-slate-900">
            Delete {truncate(product.name, 30)}
            &nbsp;incl. all surveys, responses, people, actions and attributes.{" "}
            <strong>This action cannot be undone.</strong>
          </p>
          <Button
            disabled={isDeleteDisabled}
            variant="warn"
            className={`mt-4 ${isDeleteDisabled ? "ring-grey-500 ring-1 ring-offset-1" : ""}`}
            onClick={() => setIsDeleteDialogOpen(true)}>
            Delete
          </Button>
        </div>
      )}

      {isDeleteDisabled && (
        <p className="text-sm text-red-700">
          {!isUserAdminOrOwner
            ? "Only Admin or Owners can delete products."
            : "This is your only product, it cannot be deleted. Create a new product first."}
        </p>
      )}

      <DeleteDialog
        deleteWhat="Product"
        open={isDeleteDialogOpen}
        setOpen={setIsDeleteDialogOpen}
        onDelete={handleDeleteProduct}
        text={`Are you sure you want to delete "${truncate(
          product.name,
          30
        )}"? This action cannot be undone.`}
        isDeleting={isDeleting}
      />
    </div>
  );
};

"use client";

import { deleteProductAction } from "@/app/(app)/environments/[environmentId]/settings/product/actions";
import DeleteDialog from "@/components/shared/DeleteDialog";
import { truncate } from "@/lib/utils";
import { TProduct } from "@formbricks/types/v1/product";
import { Button } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";

type DeleteProductRenderProps = {
  isDeleteDisabled: boolean;
  isUserAdminOrOwner: boolean;
  product: TProduct;
};

const DeleteProductRender: React.FC<DeleteProductRenderProps> = ({
  isDeleteDisabled,
  isUserAdminOrOwner,
  product,
}) => {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDeleteProduct = async () => {
    try {
      await deleteProductAction(product.id);
      toast.success("Product deleted successfully.");
    } catch (err) {
      console.log(err);
      toast.error("Product deleted successfully.");
    }
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
      />
    </div>
  );
};

export default DeleteProductRender;

"use client";

import { deleteProductAction } from "@/app/(app)/environments/[environmentId]/settings/product/actions";
import DeleteDialog from "@formbricks/ui/DeleteDialog";
import { truncate } from "@/lib/utils";
import { TProduct } from "@formbricks/types/v1/product";
import { Button } from "@formbricks/ui";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";

type DeleteProductRenderProps = {
  environmentId: string;
  isDeleteDisabled: boolean;
  isUserAdminOrOwner: boolean;
  product: TProduct;
  userId: string;
};

const DeleteProductRender: React.FC<DeleteProductRenderProps> = ({
  environmentId,
  isDeleteDisabled,
  isUserAdminOrOwner,
  product,
  userId,
}) => {
  const router = useRouter();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const handleDeleteProduct = async () => {
    try {
      const deletedProduct = await deleteProductAction(environmentId, userId, product.id);

      if (!!deletedProduct?.id) {
        toast.success("Product deleted successfully.");
        router.push("/");
      }
    } catch (err) {
      toast.error("Could not delete product.");
      setIsDeleteDialogOpen(false);
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

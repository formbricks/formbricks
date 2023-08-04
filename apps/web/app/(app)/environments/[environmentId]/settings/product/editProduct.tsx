"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

import { deleteProduct, useProduct } from "@/lib/products/products";
import { truncate } from "@/lib/utils";

import { useEnvironment } from "@/lib/environments/environments";
import { Button, ErrorComponent } from "@formbricks/ui";
import { useProfile } from "@/lib/profile";
import { useMembers } from "@/lib/members";

export function DeleteProduct({ environmentId }) {
  const router = useRouter();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { profile } = useProfile();
  const { team } = useMembers(environmentId);
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { environment } = useEnvironment(environmentId);

  const availableProducts = environment?.availableProducts?.length;
  const role = team?.members?.filter((member) => member?.userId === profile?.id)[0]?.role;
  const isUserAdminOrOwner = role === "admin" || role === "owner";
  const isDeleteDisabled = availableProducts <= 1 || !isUserAdminOrOwner;

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }
  if (isErrorProduct) {
    return <ErrorComponent />;
  }

  const handleDeleteProduct = async () => {
    if (environment?.availableProducts?.length <= 1) {
      toast.error("Cannot delete product. Your team needs at least 1.");
      setIsDeleteDialogOpen(false);
      return;
    }
    const deleteProductRes = await deleteProduct(environmentId);

    if (deleteProductRes?.id?.length > 0) {
      toast.success("Product deleted successfully.");
      router.push("/");
    } else if (deleteProductRes?.message?.length > 0) {
      toast.error(deleteProductRes.message);
      setIsDeleteDialogOpen(false);
    } else {
      toast.error("Error deleting product. Please try again.");
    }
  };

  return (
    <div>
      {!isDeleteDisabled && (
        <div>
          <p className="text-sm text-slate-900">
            Delete {truncate(product?.name, 30)}
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
          product?.name,
          30
        )}"? This action cannot be undone.`}
      />
    </div>
  );
}

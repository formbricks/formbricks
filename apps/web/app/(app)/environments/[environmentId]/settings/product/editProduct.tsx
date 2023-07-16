"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import DeleteDialog from "@/components/shared/DeleteDialog";
import LoadingSpinner from "@/components/shared/LoadingSpinner";

import { deleteProduct, useProduct } from "@/lib/products/products";
import { truncate } from "@/lib/utils";

import { useEnvironment } from "@/lib/environments/environments";
import { useProductMutation } from "@/lib/products/mutateProducts";
import { Button, ErrorComponent, Input, Label } from "@formbricks/ui";
import { useProfile } from "@/lib/profile";
import { useMembers } from "@/lib/members";

export function EditProductName({ environmentId }) {
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { isMutatingProduct, triggerProductMutate } = useProductMutation(environmentId);
  const { mutateEnvironment } = useEnvironment(environmentId);

  const { register, handleSubmit } = useForm();

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }
  if (isErrorProduct) {
    return <ErrorComponent />;
  }

  return (
    <form
      className="w-full max-w-sm items-center"
      onSubmit={handleSubmit((data) => {
        triggerProductMutate(data)
          .then(() => {
            toast.success("Product name updated successfully.");
            mutateEnvironment();
          })
          .catch((error) => {
            toast.error(`Error: ${error.message}`);
          });
      })}>
      <Label htmlFor="fullname">What&apos;s your product called?</Label>
      <Input type="text" id="fullname" defaultValue={product.name} {...register("name")} />

      <Button type="submit" variant="darkCTA" className="mt-4" loading={isMutatingProduct}>
        Update
      </Button>
    </form>
  );
}

export function EditWaitingTime({ environmentId }) {
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { isMutatingProduct, triggerProductMutate } = useProductMutation(environmentId);

  const { register, handleSubmit } = useForm();

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }
  if (isErrorProduct) {
    return <ErrorComponent />;
  }

  return (
    <form
      className="w-full max-w-sm items-center"
      onSubmit={handleSubmit((data) => {
        triggerProductMutate(data)
          .then(() => {
            toast.success("Waiting period updated successfully.");
          })
          .catch((error) => {
            toast.error(`Error: ${error.message}`);
          });
      })}>
      <Label htmlFor="recontactDays">Wait X days before showing next survey:</Label>
      <Input
        type="number"
        id="recontactDays"
        defaultValue={product.recontactDays}
        {...register("recontactDays", {
          min: 0,
          max: 365,
          valueAsNumber: true,
        })}
      />

      <Button type="submit" variant="darkCTA" className="mt-4" loading={isMutatingProduct}>
        Update
      </Button>
    </form>
  );
}

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
      router.push("/environments");
    } else if (deleteProductRes?.message?.length > 0) {
      toast.error(deleteProductRes.message);
      setIsDeleteDialogOpen(false);
    } else {
      toast.error("Error deleting product. Please try again.");
    }
  };

  return (
    <div>
      <p className="text-sm text-slate-900">
        Here you can delete&nbsp;
        <strong>{truncate(product?.name, 30)}</strong>
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
      {isDeleteDisabled && (
        <p className="mt-2 text-xs text-red-700">
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

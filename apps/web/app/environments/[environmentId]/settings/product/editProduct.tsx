"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import { Button } from "@formbricks/ui";
import { ErrorComponent } from "@formbricks/ui";
import { Input } from "@formbricks/ui";
import { Label } from "@formbricks/ui";
import { useProductMutation } from "@/lib/products/mutateProducts";
import { useProduct } from "@/lib/products/products";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { useEnvironment } from "@/lib/environments/environments";

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

      <Button type="submit" className="mt-4" loading={isMutatingProduct}>
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

      <Button type="submit" className="mt-4" loading={isMutatingProduct}>
        Update
      </Button>
    </form>
  );
}

export function DeleteProduct({ environmentId }) {
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }
  if (isErrorProduct) {
    return <ErrorComponent />;
  }

  return (
    <div>
      <p className="text-sm text-slate-900">
        Here you can delete {product.name} incl. all surveys, responses, people, actions and attributes.{" "}
        <strong>This action cannot be undone.</strong>
      </p>
      <Button variant="warn" className="mt-4">
        Delete {product.name}
      </Button>
    </div>
  );
}

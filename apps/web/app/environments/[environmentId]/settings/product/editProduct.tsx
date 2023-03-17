"use client";

import LoadingSpinner from "@/components/shared/LoadingSpinner";
import Button from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useProduct } from "@/lib/products/products";
import { Label } from "@/components/ui/Label";
import { useForm } from "react-hook-form";
import { useProductMutation } from "@/lib/products/mutateProducts";

export function EditProductName({ environmentId }) {
  const { product, isLoadingProduct, isErrorProduct } = useProduct(environmentId);
  const { isMutatingProduct, triggerProductMutate } = useProductMutation(environmentId);

  const { register, handleSubmit } = useForm();

  if (isLoadingProduct) {
    return <LoadingSpinner />;
  }
  if (isErrorProduct) {
    return <div>Error</div>;
  }

  return (
    <form
      className="w-full max-w-sm items-center"
      onSubmit={handleSubmit((data) => {
        triggerProductMutate(data);
      })}>
      <Label htmlFor="fullname">Full Name</Label>
      <Input type="text" id="fullname" defaultValue={product.name} {...register("name")} />

      <Button type="submit" className="mt-4" loading={isMutatingProduct}>
        Update
      </Button>
    </form>
  );
}

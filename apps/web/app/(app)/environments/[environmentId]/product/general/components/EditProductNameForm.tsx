"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

import { updateProductAction } from "../actions";

type EditProductNameProps = {
  product: TProduct;
  environmentId: string;
  isProductNameEditDisabled: boolean;
};

const editProductNameSchema = z.object({
  name: z.string().trim().min(1, { message: "Product name cannot be empty" }),
});

type TEditProductName = z.infer<typeof editProductNameSchema>;

export const EditProductNameForm: React.FC<EditProductNameProps> = ({
  product,
  environmentId,
  isProductNameEditDisabled,
}) => {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm<TEditProductName>({
    defaultValues: {
      name: product.name,
    },
    resolver: zodResolver(editProductNameSchema),
    mode: "onChange",
  });

  const nameError = errors.name?.message;

  const updateProduct: SubmitHandler<TEditProductName> = async (data) => {
    const name = data.name.trim();
    try {
      if (nameError) {
        toast.error(nameError);
        return;
      }

      if (name === product.name) {
        toast.success("This is already your product name");
        return;
      }

      const updatedProduct = await updateProductAction(environmentId, product.id, { name });

      if (isProductNameEditDisabled) {
        toast.error("Only Owners, Admins and Editors can perform this action.");
        throw new Error();
      }

      if (!!updatedProduct?.id) {
        toast.success("Product name updated successfully.");
        router.refresh();
      }
    } catch (err) {
      console.error(err);
      toast.error(`Error: Unable to save product information`);
    }
  };

  return !isProductNameEditDisabled ? (
    <form className="w-full max-w-sm items-center space-y-2" onSubmit={handleSubmit(updateProduct)}>
      <Label htmlFor="fullname">What&apos;s your product called?</Label>
      <Input type="text" id="fullname" defaultValue={product.name} {...register("name")} />
      <Button
        type="submit"
        variant="darkCTA"
        size="sm"
        loading={isSubmitting}
        disabled={!!nameError || isSubmitting}>
        Update
      </Button>
    </form>
  ) : (
    <p className="text-sm text-red-700">Only Owners, Admins and Editors can perform this action.</p>
  );
};

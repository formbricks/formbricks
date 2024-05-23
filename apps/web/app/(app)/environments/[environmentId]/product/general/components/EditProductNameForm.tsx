"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { TProduct, ZProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";

import { updateProductAction } from "../actions";

type EditProductNameProps = {
  product: TProduct;
  environmentId: string;
  isProductNameEditDisabled: boolean;
};

const editProductNameSchema = ZProduct.pick({ name: true });

type TEditProductName = z.infer<typeof editProductNameSchema>;

export const EditProductNameForm: React.FC<EditProductNameProps> = ({
  product,
  environmentId,
  isProductNameEditDisabled,
}) => {
  const router = useRouter();
  const form = useForm<TEditProductName>({
    defaultValues: {
      name: product.name,
    },
    resolver: zodResolver(editProductNameSchema),
    mode: "onChange",
  });

  const nameError = form.formState.errors.name?.message;
  const isSubmitting = form.formState.isSubmitting;

  const updateProduct: SubmitHandler<TEditProductName> = async (data) => {
    const name = data.name.trim();
    try {
      if (nameError) {
        toast.error(nameError);
        return;
      }

      if (name === product.name) {
        form.setError("name", { type: "manual", message: "Product name is the same" }, { shouldFocus: true });
        return;
      }

      const updatedProduct = await updateProductAction(environmentId, product.id, { name });

      if (isProductNameEditDisabled) {
        toast.error("Only Owners, Admins and Editors can perform this action.");
        return;
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
    <Form {...form}>
      <form className="w-full max-w-sm items-center space-y-2" onSubmit={form.handleSubmit(updateProduct)}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="name">What&apos;s your product called?</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  id="name"
                  {...field}
                  placeholder="Product Name"
                  autoComplete="off"
                  required
                  isInvalid={!!nameError}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" variant="darkCTA" size="sm" loading={isSubmitting} disabled={isSubmitting}>
          Update
        </Button>
      </form>
    </Form>
  ) : (
    <p className="text-sm text-red-700">Only Owners, Admins and Editors can perform this action.</p>
  );
};

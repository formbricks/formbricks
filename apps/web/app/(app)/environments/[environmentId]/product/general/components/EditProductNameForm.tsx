"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRef } from "react";
import { useFormState } from "react-dom";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { TProduct, ZProduct } from "@formbricks/types/product";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormProvider } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";

import { updateProductAction, updateProductFormAction } from "../actions";
import { SubmitButton } from "./SubmitBtn";

type EditProductNameProps = {
  product: TProduct;
  environmentId: string;
  isProductNameEditDisabled: boolean;
};

const ZProductNameInput = ZProduct.pick({ name: true });

type TEditProductName = z.infer<typeof ZProductNameInput>;

export const EditProductNameForm: React.FC<EditProductNameProps> = ({
  product,
  environmentId,
  isProductNameEditDisabled,
}) => {
  const form = useForm<TEditProductName>({
    defaultValues: {
      name: product.name,
    },
    resolver: zodResolver(ZProductNameInput),
    mode: "onChange",
  });

  const formRef = useRef<HTMLFormElement>(null);

  const [serverState, formAction] = useFormState(updateProductFormAction, {
    params: { environmentId, productId: product.id },
  });

  const { errors, isDirty } = form.formState;

  const nameError = errors.name?.message;
  // const isSubmitting = form.formState.isSubmitting;

  // const updateProduct: SubmitHandler<TEditProductName> = async (data) => {
  //   const name = data.name.trim();
  //   try {
  //     if (nameError) {
  //       toast.error(nameError);
  //       return;
  //     }

  //     const updatedProduct = await updateProductAction(environmentId, product.id, { name });

  //     if (isProductNameEditDisabled) {
  //       toast.error("Only Owners, Admins and Editors can perform this action.");
  //       return;
  //     }

  //     if (!!updatedProduct?.id) {
  //       toast.success("Product name updated successfully.");
  //       form.resetField("name", { defaultValue: updatedProduct.name });
  //     }
  //   } catch (err) {
  //     console.error(err);
  //     toast.error(`Error: Unable to save product information`);
  //   }
  // };

  return !isProductNameEditDisabled ? (
    <FormProvider {...form}>
      <form
        ref={formRef}
        className="w-full max-w-sm items-center space-y-2"
        action={formAction}
        onSubmit={(e) =>
          form.handleSubmit(() => {
            e.preventDefault();
            formRef.current?.submit();
          })
        }>
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

        <SubmitButton />
      </form>
    </FormProvider>
  ) : (
    <p className="text-sm text-red-700">Only Owners, Admins and Editors can perform this action.</p>
  );
};

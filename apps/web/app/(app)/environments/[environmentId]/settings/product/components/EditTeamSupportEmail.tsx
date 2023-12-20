"use client";

import { updateProductAction } from "@/app/(app)/environments/[environmentId]/settings/lookandfeel/actions";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SubmitHandler, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { TProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";

const ZEmail = z.string().email("Please enter a valid email address.");

type TProductSupportEmailForm = {
  supportEmail: string;
};

type EditProductSupportEmailProps = {
  environmentId: string;
  product: TProduct;
};

export default function EditProductSupportEmail({ product }: EditProductSupportEmailProps) {
  const router = useRouter();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TProductSupportEmailForm>({
    defaultValues: {
      supportEmail: product.supportEmail ?? "",
    },
    mode: "onSubmit",
  });
  const [isUpdatingProduct, setIsUpdatingProduct] = useState(false);

  const supportEmail = useWatch({
    control,
    name: "supportEmail",
  });

  const currentSupportEmail = supportEmail?.trim().toLowerCase() ?? "";
  const previousProductName = product?.supportEmail?.trim().toLowerCase() ?? "";

  const handleUpdateProduct: SubmitHandler<TProductSupportEmailForm> = async (data) => {
    try {
      setIsUpdatingProduct(true);
      const supportEmail = data.supportEmail ? data.supportEmail.trim() : null;
      await updateProductAction(product.id, { supportEmail });

      setIsUpdatingProduct(false);
      toast.success(
        data.supportEmail ? "Support email updated successfully." : "Support email removed successfully."
      );

      router.refresh();
    } catch (err) {
      setIsUpdatingProduct(false);
      toast.error(`Error: ${err.message}`);
    }
  };

  return (
    <form className="w-full max-w-sm items-center" onSubmit={handleSubmit(handleUpdateProduct)}>
      <Label htmlFor="supportEmail">Public Support Email</Label>
      <Input
        type="text"
        id="supportEmail"
        defaultValue={product?.supportEmail ?? ""}
        {...register("supportEmail", {
          validate: (value) => {
            // allow user to unset support email
            if (value === "") {
              return true;
            }
            const validatedInput = ZEmail.safeParse(value);
            return validatedInput.success || validatedInput.error.errors[0].message;
          },
        })}
      />

      {supportEmail && errors?.supportEmail?.message && (
        <p className="text-xs text-red-500">{errors.supportEmail.message}</p>
      )}

      <Button
        type="submit"
        className="mt-4"
        variant="darkCTA"
        loading={isUpdatingProduct}
        disabled={currentSupportEmail === previousProductName}>
        Update
      </Button>
    </form>
  );
}

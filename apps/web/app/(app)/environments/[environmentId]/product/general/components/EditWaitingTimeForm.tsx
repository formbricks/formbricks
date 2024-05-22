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

type EditWaitingTimeProps = {
  environmentId: string;
  product: TProduct;
};

const editWaitingTimeSchema = z.object({
  recontactDays: z
    .number({ message: "Recontact days is required" })
    .min(0, { message: "Must be a positive number" })
    .max(365, { message: "Must be less than 365" }),
});

type EditWaitingTimeFormValues = z.infer<typeof editWaitingTimeSchema>;

export const EditWaitingTimeForm: React.FC<EditWaitingTimeProps> = ({ product, environmentId }) => {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditWaitingTimeFormValues>({
    defaultValues: {
      recontactDays: product.recontactDays,
    },
    resolver: zodResolver(editWaitingTimeSchema),
    mode: "onChange",
  });

  const updateWaitingTime: SubmitHandler<EditWaitingTimeFormValues> = async (data) => {
    try {
      const updatedProduct = await updateProductAction(environmentId, product.id, data);
      if (!!updatedProduct?.id) {
        toast.success("Waiting period updated successfully.");
        router.refresh();
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  return (
    <form className="w-full max-w-sm items-center space-y-2" onSubmit={handleSubmit(updateWaitingTime)}>
      <Label htmlFor="recontactDays">Wait X days before showing next survey:</Label>
      <Input
        type="number"
        id="recontactDays"
        defaultValue={product.recontactDays}
        {...register("recontactDays", {
          valueAsNumber: true,
        })}
      />

      {errors?.recontactDays ? (
        <div className="my-2">
          <p className="text-xs text-red-500">{errors?.recontactDays?.message}</p>
        </div>
      ) : null}

      <Button type="submit" variant="darkCTA" size="sm" disabled={Object.keys(errors).length > 0}>
        Update
      </Button>
    </form>
  );
};

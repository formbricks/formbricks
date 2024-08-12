"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { TProduct, ZProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { FormControl, FormError, FormField, FormItem, FormLabel, FormProvider } from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";
import { updateProductAction } from "../../actions";

type EditWaitingTimeProps = {
  product: TProduct;
};

const ZProductRecontactDaysInput = ZProduct.pick({ recontactDays: true });

type EditWaitingTimeFormValues = z.infer<typeof ZProductRecontactDaysInput>;

export const EditWaitingTimeForm: React.FC<EditWaitingTimeProps> = ({ product }) => {
  const form = useForm<EditWaitingTimeFormValues>({
    defaultValues: {
      recontactDays: product.recontactDays,
    },
    resolver: zodResolver(ZProductRecontactDaysInput),
    mode: "onChange",
  });

  const { isDirty, isSubmitting } = form.formState;

  const updateWaitingTime: SubmitHandler<EditWaitingTimeFormValues> = async (data) => {
    try {
      const updatedProductResponse = await updateProductAction({ productId: product.id, data });
      if (updatedProductResponse?.data) {
        toast.success("Waiting period updated successfully.");
        form.resetField("recontactDays", { defaultValue: updatedProductResponse.data.recontactDays });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedProductResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      toast.error(`Error: ${err.message}`);
    }
  };

  return (
    <FormProvider {...form}>
      <form
        className="flex w-full max-w-sm flex-col space-y-4"
        onSubmit={form.handleSubmit(updateWaitingTime)}>
        <FormField
          control={form.control}
          name="recontactDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="recontactDays">Wait X days before showing next survey:</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  id="recontactDays"
                  {...field}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      field.onChange("");
                    }

                    field.onChange(parseInt(value, 10));
                  }}
                />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="sm"
          className="w-fit"
          loading={isSubmitting}
          disabled={isSubmitting || !isDirty}>
          Update
        </Button>
      </form>
    </FormProvider>
  );
};

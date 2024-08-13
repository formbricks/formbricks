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
import { updateProductAction } from "../actions";

type EditDefaultRewardProps = {
  environmentId: string;
  product: TProduct;
};

const ZDefaultRewardInput = ZProduct.pick({ defaultRewardInUSD: true });

type TEditDefaultReward = z.infer<typeof ZDefaultRewardInput>;

export const EditDefaultReward: React.FC<EditDefaultRewardProps> = ({ product }) => {
  const form = useForm<TEditDefaultReward>({
    defaultValues: {
      defaultRewardInUSD: product.defaultRewardInUSD,
    },
    resolver: zodResolver(ZDefaultRewardInput),
    mode: "onChange",
  });

  const { errors, isDirty } = form.formState;
  const rewardError = errors.defaultRewardInUSD?.message;
  const isSubmitting = form.formState.isSubmitting;

  const updateDefaultReward: SubmitHandler<TEditDefaultReward> = async (data) => {
    try {
      if (rewardError) {
        toast.error(rewardError);
        return;
      }

      const updatedProductResponse = await updateProductAction({
        productId: product.id,
        data: {
          defaultRewardInUSD: data.defaultRewardInUSD,
        },
      });

      if (updatedProductResponse?.data) {
        toast.success("Default reward updated successfully.");
        form.resetField("defaultRewardInUSD", {
          defaultValue: updatedProductResponse.data.defaultRewardInUSD,
        });
      } else {
        const errorMessage = getFormattedErrorMessage(updatedProductResponse);
        toast.error(errorMessage);
      }
    } catch (err) {
      console.error(err);
      toast.error(`Error: Unable to save product information`);
    }
  };

  return (
    <FormProvider {...form}>
      <form
        className="w-full max-w-sm items-center space-y-2"
        onSubmit={form.handleSubmit(updateDefaultReward)}>
        <FormField
          control={form.control}
          name="defaultRewardInUSD"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="defaultRewardInUSD">
                Amount received for successful survey completion in USD:
              </FormLabel>
              <FormControl>
                <Input
                  type="number"
                  id="defaultRewardInUSD"
                  step="0.01"
                  {...field}
                  placeholder="0.00"
                  autoComplete="off"
                  required
                  isInvalid={!!rewardError}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.valueAsNumber)}
                />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <Button type="submit" size="sm" loading={isSubmitting} disabled={isSubmitting || !isDirty}>
          Update
        </Button>
      </form>
    </FormProvider>
  );
};

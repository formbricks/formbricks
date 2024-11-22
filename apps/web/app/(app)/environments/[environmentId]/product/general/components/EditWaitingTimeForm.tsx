"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import {
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@/modules/ui/components/form";
import { Input } from "@/modules/ui/components/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { TProduct, ZProduct } from "@formbricks/types/product";
import { updateProductAction } from "../../actions";

type EditWaitingTimeProps = {
  product: TProduct;
  isReadOnly: boolean;
};

const ZProductRecontactDaysInput = ZProduct.pick({ recontactDays: true });

type EditWaitingTimeFormValues = z.infer<typeof ZProductRecontactDaysInput>;

export const EditWaitingTimeForm: React.FC<EditWaitingTimeProps> = ({ product, isReadOnly }) => {
  const t = useTranslations();
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
        toast.success(t("environments.product.general.waiting_period_updated_successfully"));
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
    <>
      <FormProvider {...form}>
        <form
          className="flex w-full max-w-sm flex-col space-y-4"
          onSubmit={form.handleSubmit(updateWaitingTime)}>
          <FormField
            control={form.control}
            name="recontactDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="recontactDays">
                  {t("environments.product.general.wait_x_days_before_showing_next_survey")}
                </FormLabel>
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
                    disabled={isReadOnly}
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
            disabled={isSubmitting || !isDirty || isReadOnly}>
            {t("common.update")}
          </Button>
        </form>
      </FormProvider>
      {isReadOnly && (
        <Alert variant="warning" className="mt-4">
          <AlertDescription>
            {t("common.only_owners_managers_and_manage_access_members_can_perform_this_action")}
          </AlertDescription>
        </Alert>
      )}
    </>
  );
};

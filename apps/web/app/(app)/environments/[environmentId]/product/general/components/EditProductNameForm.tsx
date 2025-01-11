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

type EditProductNameProps = {
  product: TProduct;
  isReadOnly: boolean;
};

const ZProductNameInput = ZProduct.pick({ name: true });

type TEditProductName = z.infer<typeof ZProductNameInput>;

export const EditProductNameForm: React.FC<EditProductNameProps> = ({ product, isReadOnly }) => {
  const t = useTranslations();
  const form = useForm<TEditProductName>({
    defaultValues: {
      name: product.name,
    },
    resolver: zodResolver(ZProductNameInput),
    mode: "onChange",
  });

  const { errors, isDirty } = form.formState;

  const nameError = errors.name?.message;
  const isSubmitting = form.formState.isSubmitting;

  const updateProduct: SubmitHandler<TEditProductName> = async (data) => {
    const name = data.name.trim();
    try {
      if (nameError) {
        toast.error(nameError);
        return;
      }

      const updatedProductResponse = await updateProductAction({
        productId: product.id,
        data: {
          name,
        },
      });

      if (updatedProductResponse?.data) {
        toast.success(t("environments.product.general.product_name_updated_successfully"));
        form.resetField("name", { defaultValue: updatedProductResponse.data.name });
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
    <>
      <FormProvider {...form}>
        <form className="w-full max-w-sm items-center space-y-2" onSubmit={form.handleSubmit(updateProduct)}>
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="name">
                  {t("environments.product.general.whats_your_product_called")}
                </FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    id="name"
                    {...field}
                    placeholder={t("common.product_name")}
                    autoComplete="off"
                    required
                    isInvalid={!!nameError}
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

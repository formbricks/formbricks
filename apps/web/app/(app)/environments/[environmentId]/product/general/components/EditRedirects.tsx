"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { SubmitHandler, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { TProduct, ZProduct } from "@formbricks/types/product";
import { Button } from "@formbricks/ui/components/Button";
import { FormControl, FormError, FormField, FormItem, FormLabel, FormProvider } from "@formbricks/ui/components/Form";
import { Input } from "@formbricks/ui/components/Input";
import { updateProductAction } from "../../actions";

type EditRedirectsProps = {
  product: TProduct;
};

const ZRedirectsInput = ZProduct.pick({
  defaultRedirectOnCompleteUrl: true,
  defaultRedirectOnFailUrl: true,
});

type TEditRedirects = z.infer<typeof ZRedirectsInput>;

export const EditRedirects: React.FC<EditRedirectsProps> = ({ product }) => {
  const form = useForm<TEditRedirects>({
    defaultValues: {
      defaultRedirectOnCompleteUrl: product.defaultRedirectOnCompleteUrl,
      defaultRedirectOnFailUrl: product.defaultRedirectOnFailUrl,
    },
    resolver: zodResolver(ZRedirectsInput),
    mode: "onChange",
  });

  const { errors, isDirty } = form.formState;
  const completeUrlError = errors.defaultRedirectOnCompleteUrl?.message;
  const failUrlError = errors.defaultRedirectOnFailUrl?.message;
  const isSubmitting = form.formState.isSubmitting;

  const updateRedirects: SubmitHandler<TEditRedirects> = async (data) => {
    try {
      if (completeUrlError || failUrlError) {
        toast.error(completeUrlError || failUrlError || "Unknown error");
        return;
      }

      const updatedProductResponse = await updateProductAction({
        productId: product.id,
        data: {
          defaultRedirectOnCompleteUrl: data.defaultRedirectOnCompleteUrl,
          defaultRedirectOnFailUrl: data.defaultRedirectOnFailUrl,
        },
      });

      if (updatedProductResponse?.data) {
        toast.success("Default redirects updated successfully.");
        form.resetField("defaultRedirectOnCompleteUrl", {
          defaultValue: updatedProductResponse.data.defaultRedirectOnCompleteUrl,
        });
        form.resetField("defaultRedirectOnFailUrl", {
          defaultValue: updatedProductResponse.data.defaultRedirectOnFailUrl,
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
      <form className="w-full max-w-sm items-center space-y-2" onSubmit={form.handleSubmit(updateRedirects)}>
        <FormField
          control={form.control}
          name="defaultRedirectOnCompleteUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="defaultRedirectOnCompleteUrl">Redirect on complete URL:</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  id="defaultRedirectOnCompleteUrl"
                  {...field}
                  placeholder="https://member.digiopinion.com/overview"
                  autoComplete="off"
                  required
                  isInvalid={!!completeUrlError}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormError />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="defaultRedirectOnFailUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel htmlFor="defaultRedirectOnFailUrl">Redirect on fail URL:</FormLabel>
              <FormControl>
                <Input
                  type="url"
                  id="defaultRedirectOnFailUrl"
                  {...field}
                  placeholder="https://member.digiopinion.com/overview"
                  autoComplete="off"
                  required
                  isInvalid={!!failUrlError}
                  value={field.value ?? ""}
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

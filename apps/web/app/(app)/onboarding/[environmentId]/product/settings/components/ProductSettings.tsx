"use client";

import { finishProductOnboardingAction, updateProductAction } from "@/app/(app)/onboarding/actions";
import { getCustomHeadline } from "@/app/(app)/onboarding/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { PREVIEW_SURVEY } from "@formbricks/lib/styling/constants";
import {
  TProduct,
  TProductConfigChannel,
  TProductConfigIndustry,
  TProductUpdateInput,
  ZProductUpdateInput,
} from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { FileInput } from "@formbricks/ui/FileInput";
import {
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@formbricks/ui/Form";
import { Input } from "@formbricks/ui/Input";
import { SurveyInline } from "@formbricks/ui/Survey";

interface ProductSettingsProps {
  environmentId: string;
  channel: TProductConfigChannel;
  industry: TProductConfigIndustry;
  product: TProduct;
  defaultBrandColor: string;
}

export const ProductSettings = ({
  environmentId,
  channel,
  industry,
  product,
  defaultBrandColor,
}: ProductSettingsProps) => {
  const router = useRouter();

  const updateProduct = async (data: TProductUpdateInput) => {
    try {
      await updateProductAction(product.id, {
        name: data.name,
        brandColor: data.brandColor,
        logo: { url: logoUrl, bgColor: undefined },
      });
      if (channel !== "link") {
        router.push(`/onboarding/${environmentId}/connect?channel=${channel}&industry=${industry}`);
      } else {
        await finishProductOnboardingAction(product.id, { channel, industry });
        router.push(`/environments/${environmentId}/surveys?channel=${channel}&industry=${industry}`);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const form = useForm<TProductUpdateInput>({
    defaultValues: {
      name: product.name,
      brandColor: defaultBrandColor,
      logo: {
        url: "",
        bgColor: undefined,
      },
    },
    resolver: zodResolver(ZProductUpdateInput),
  });
  const logoUrl = form.watch("logo.url");
  const brandColor = form.watch("brandColor") ?? defaultBrandColor;
  const { isSubmitting } = form.formState;

  return (
    <div className="mt-6 flex w-5/6 space-x-10 lg:w-2/3 2xl:w-1/2">
      <div className="flex w-1/2 flex-col space-y-4">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(updateProduct)} className="w-full space-y-4">
            <FormField
              control={form.control}
              name="brandColor"
              render={({ field, fieldState: { error } }) => (
                <FormItem className="w-full space-y-4">
                  <div>
                    <FormLabel>Brand color</FormLabel>
                    <FormDescription>Change the brand color of the survey.</FormDescription>
                  </div>
                  <FormControl>
                    <div>
                      <ColorPicker
                        color={field.value || defaultBrandColor}
                        onChange={(color) => field.onChange(color)}
                      />
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field, fieldState: { error } }) => (
                <FormItem className="w-full space-y-4">
                  <div>
                    <FormLabel>Product Name</FormLabel>
                    <FormDescription>
                      What is your {getCustomHeadline(channel, industry)} called ?
                    </FormDescription>
                  </div>
                  <FormControl>
                    <div>
                      <Input
                        value={field.value}
                        onChange={(name) => field.onChange(name)}
                        placeholder="Formbricks Merch Store"
                        className="bg-white"
                      />
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            {channel === "link" && (
              <div>
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt="Logo"
                    width={256}
                    height={56}
                    className="-mb-6 h-20 w-auto max-w-64 rounded-lg border object-contain p-1"
                  />
                ) : (
                  <FormField
                    control={form.control}
                    name="logo.url"
                    render={({ field }) => (
                      <FormItem className="w-full space-y-4">
                        <div>
                          <FormLabel>Company Logo</FormLabel>
                        </div>
                        <FormControl>
                          <FileInput
                            id="logo-input"
                            allowedFileExtensions={["png", "jpeg", "jpg"]}
                            environmentId={environmentId}
                            onFileUpload={(files: string[]) => {
                              field.onChange(files[0]);
                            }}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                )}
              </div>
            )}
            <div className="flex w-full justify-end">
              <Button variant="darkCTA" loading={isSubmitting} type="submit">
                Next
              </Button>
            </div>
          </form>
        </FormProvider>
      </div>

      <div className="relative flex h-[30rem] w-1/2 flex-col items-center justify-center space-y-2 rounded-lg border bg-slate-200 shadow">
        {logoUrl && (
          <Image
            src={logoUrl}
            alt="Logo"
            width={256}
            height={56}
            className="absolute left-2 top-2 -mb-6 h-20 w-auto max-w-64 rounded-lg border object-contain p-1"
          />
        )}
        <p className="text-sm text-slate-400">Preview</p>
        <div className="h-3/4 w-3/4">
          <SurveyInline
            survey={PREVIEW_SURVEY}
            styling={{ brandColor: { light: brandColor } }}
            isBrandingEnabled={false}
            languageCode="default"
            onFileUpload={async (file) => file.name}
            autoFocus={false}
          />
        </div>
      </div>
    </div>
  );
};

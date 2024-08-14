"use client";

import { getCustomHeadline } from "@/app/(app)/(onboarding)/lib/utils";
import { createProductAction } from "@/app/(app)/environments/[environmentId]/actions";
import { zodResolver } from "@hookform/resolvers/zod";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { PREVIEW_SURVEY } from "@formbricks/lib/styling/constants";
import {
  TProductConfigChannel,
  TProductConfigIndustry,
  TProductUpdateInput,
  ZProductUpdateInput,
} from "@formbricks/types/product";
import { Button } from "@formbricks/ui/Button";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
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
  organizationId: string;
  channel: TProductConfigChannel;
  industry: TProductConfigIndustry;
  defaultBrandColor: string;
}

export const ProductSettings = ({
  organizationId,
  channel,
  industry,
  defaultBrandColor,
}: ProductSettingsProps) => {
  const router = useRouter();

  const addProduct = async (data: TProductUpdateInput) => {
    try {
      const createProductResponse = await createProductAction({
        organizationId,
        data: {
          ...data,
          config: { channel, industry },
        },
      });

      if (createProductResponse?.data) {
        // get production environment
        const productionEnvironment = createProductResponse.data.environments.find(
          (environment) => environment.type === "production"
        );
        if (channel !== "link") {
          router.push(`/environments/${productionEnvironment?.id}/connect`);
        } else {
          router.push(`/environments/${productionEnvironment?.id}/surveys`);
        }
      } else {
        const errorMessage = getFormattedErrorMessage(createProductResponse);
        toast.error(errorMessage);
      }
    } catch (error) {
      toast.error("Product creation failed");
      console.error(error);
    }
  };

  const form = useForm<TProductUpdateInput>({
    defaultValues: {
      name: "",
      styling: { allowStyleOverwrite: true, brandColor: { light: defaultBrandColor } },
    },
    resolver: zodResolver(ZProductUpdateInput),
  });
  const logoUrl = form.watch("logo.url");
  const brandColor = form.watch("styling.brandColor.light") ?? defaultBrandColor;
  const { isSubmitting } = form.formState;

  return (
    <div className="mt-6 flex w-5/6 space-x-10 lg:w-2/3 2xl:w-1/2">
      <div className="flex w-1/2 flex-col space-y-4">
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(addProduct)} className="w-full space-y-4">
            <FormField
              control={form.control}
              name="styling.brandColor.light"
              render={({ field, fieldState: { error } }) => (
                <FormItem className="w-full space-y-4">
                  <div>
                    <FormLabel>Brand color</FormLabel>
                    <FormDescription>Match the main color of surveys with your brand.</FormDescription>
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
                    <FormLabel>Product name</FormLabel>
                    <FormDescription>
                      What is your {getCustomHeadline(channel, industry)} called?
                    </FormDescription>
                  </div>
                  <FormControl>
                    <div>
                      <Input
                        value={field.value}
                        onChange={(name) => field.onChange(name)}
                        placeholder="e.g. Formbricks"
                        className="bg-white"
                        autoFocus={true}
                      />
                      {error?.message && <FormError className="text-left">{error.message}</FormError>}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <div className="flex w-full justify-end">
              <Button loading={isSubmitting} type="submit">
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

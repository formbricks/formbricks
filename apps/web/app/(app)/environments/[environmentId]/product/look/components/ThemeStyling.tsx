"use client";

import { BackgroundStylingCard } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/BackgroundStylingCard";
import { CardStylingSettings } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/CardStylingSettings";
import { FormStylingSettings } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/[surveyId]/edit/components/FormStylingSettings";
import { ThemeStylingPreviewSurvey } from "@/app/(app)/environments/[environmentId]/product/look/components/ThemeStylingPreviewSurvey";
import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { SubmitHandler, UseFormReturn, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { COLOR_DEFAULTS, PREVIEW_SURVEY } from "@formbricks/lib/styling/constants";
import { TProduct, TProductStyling, ZProductStyling } from "@formbricks/types/product";
import { TSurvey, TSurveyStyling, TSurveyType } from "@formbricks/types/surveys/types";
import { AlertDialog } from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@formbricks/ui/Form";
import { Switch } from "@formbricks/ui/Switch";
import { updateProductAction } from "../../actions";

type ThemeStylingProps = {
  product: TProduct;
  environmentId: string;
  colors: string[];
  isUnsplashConfigured: boolean;
};

export const ThemeStyling = ({ product, environmentId, colors, isUnsplashConfigured }: ThemeStylingProps) => {
  const router = useRouter();

  const form = useForm<TProductStyling>({
    defaultValues: {
      ...product.styling,

      // specify the default values for the colors
      allowStyleOverwrite: product.styling.allowStyleOverwrite ?? true,
      brandColor: { light: product.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor },
      questionColor: { light: product.styling.questionColor?.light ?? COLOR_DEFAULTS.questionColor },
      inputColor: { light: product.styling.inputColor?.light ?? COLOR_DEFAULTS.inputColor },
      inputBorderColor: { light: product.styling.inputBorderColor?.light ?? COLOR_DEFAULTS.inputBorderColor },
      cardBackgroundColor: {
        light: product.styling.cardBackgroundColor?.light ?? COLOR_DEFAULTS.cardBackgroundColor,
      },
      cardBorderColor: { light: product.styling.cardBorderColor?.light ?? COLOR_DEFAULTS.cardBorderColor },
      cardShadowColor: { light: product.styling.cardShadowColor?.light ?? COLOR_DEFAULTS.cardShadowColor },
      highlightBorderColor: product.styling.highlightBorderColor?.light
        ? {
            light: product.styling.highlightBorderColor.light,
          }
        : undefined,
      isDarkModeEnabled: product.styling.isDarkModeEnabled ?? false,
      roundness: product.styling.roundness ?? 8,
      cardArrangement: product.styling.cardArrangement ?? {
        linkSurveys: "simple",
        appSurveys: "simple",
      },
      background: product.styling.background,
      hideProgressBar: product.styling.hideProgressBar ?? false,
      isLogoHidden: product.styling.isLogoHidden ?? false,
    },
    resolver: zodResolver(ZProductStyling),
  });

  const [previewSurveyType, setPreviewSurveyType] = useState<TSurveyType>("link");
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [backgroundStylingOpen, setBackgroundStylingOpen] = useState(false);

  const onReset = useCallback(async () => {
    const defaultStyling: TProductStyling = {
      allowStyleOverwrite: true,
      brandColor: {
        light: COLOR_DEFAULTS.brandColor,
      },
      questionColor: {
        light: COLOR_DEFAULTS.questionColor,
      },
      inputColor: {
        light: COLOR_DEFAULTS.inputColor,
      },
      inputBorderColor: {
        light: COLOR_DEFAULTS.inputBorderColor,
      },
      cardBackgroundColor: {
        light: COLOR_DEFAULTS.cardBackgroundColor,
      },
      cardBorderColor: {
        light: COLOR_DEFAULTS.cardBorderColor,
      },
      isLogoHidden: false,
      highlightBorderColor: undefined,
      isDarkModeEnabled: false,
      background: {
        bg: "#fff",
        bgType: "color",
      },
      roundness: 8,
      cardArrangement: {
        linkSurveys: "simple",
        appSurveys: "simple",
      },
    };

    await updateProductAction({
      productId: product.id,
      data: {
        styling: { ...defaultStyling },
      },
    });

    form.reset({ ...defaultStyling });

    toast.success("Styling updated successfully.");
    router.refresh();
  }, [form, product.id, router]);

  const onSubmit: SubmitHandler<TProductStyling> = async (data) => {
    const updatedProductResponse = await updateProductAction({
      productId: product.id,
      data: {
        styling: data,
      },
    });

    if (updatedProductResponse?.data) {
      form.reset({ ...updatedProductResponse.data.styling });
      toast.success("Styling updated successfully.");
    } else {
      const errorMessage = getFormattedErrorMessage(updatedProductResponse);
      toast.error(errorMessage);
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="flex">
          {/* Styling settings */}
          <div className="relative flex w-1/2 flex-col pr-6">
            <div className="flex flex-1 flex-col gap-4">
              <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
                <div className="flex items-center gap-6">
                  <FormField
                    control={form.control}
                    name="allowStyleOverwrite"
                    render={({ field }) => (
                      <FormItem className="flex w-full items-center gap-2 space-y-0">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(value) => {
                              field.onChange(value);
                            }}
                          />
                        </FormControl>

                        <div>
                          <FormLabel>Enable custom styling</FormLabel>
                          <FormDescription>
                            Allow users to override this theme in the survey editor.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-lg bg-slate-50 p-4">
                <FormStylingSettings
                  open={formStylingOpen}
                  setOpen={setFormStylingOpen}
                  isSettingsPage
                  form={form as UseFormReturn<TProductStyling | TSurveyStyling>}
                />

                <CardStylingSettings
                  open={cardStylingOpen}
                  setOpen={setCardStylingOpen}
                  isSettingsPage
                  product={product}
                  surveyType={previewSurveyType}
                  form={form as UseFormReturn<TProductStyling | TSurveyStyling>}
                />

                <BackgroundStylingCard
                  open={backgroundStylingOpen}
                  setOpen={setBackgroundStylingOpen}
                  environmentId={environmentId}
                  colors={colors}
                  key={form.watch("background.bg")}
                  isSettingsPage
                  isUnsplashConfigured={isUnsplashConfigured}
                  form={form as UseFormReturn<TProductStyling | TSurveyStyling>}
                />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <Button size="sm" type="submit">
                Save
              </Button>
              <Button
                type="button"
                size="sm"
                variant="minimal"
                className="flex items-center gap-2"
                onClick={() => setConfirmResetStylingModalOpen(true)}>
                Reset to default
                <RotateCcwIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Survey Preview */}

          <div className="relative w-1/2 rounded-lg bg-slate-100 pt-4">
            <div className="sticky top-4 mb-4 h-[600px]">
              <ThemeStylingPreviewSurvey
                setQuestionId={(_id: string) => {}}
                survey={PREVIEW_SURVEY as TSurvey}
                product={{
                  ...product,
                  styling: form.getValues(),
                }}
                previewType={previewSurveyType}
                setPreviewType={setPreviewSurveyType}
              />
            </div>
          </div>

          {/* Confirm reset styling modal */}
          <AlertDialog
            open={confirmResetStylingModalOpen}
            setOpen={setConfirmResetStylingModalOpen}
            headerText="Reset styling"
            mainText="Are you sure you want to reset the styling to default?"
            confirmBtnLabel="Confirm"
            onConfirm={() => {
              onReset();
              setConfirmResetStylingModalOpen(false);
            }}
            onDecline={() => setConfirmResetStylingModalOpen(false)}
          />
        </div>
      </form>
    </FormProvider>
  );
};

import { RotateCcwIcon } from "lucide-react";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { UseFormReturn, useForm, useWatch } from "react-hook-form";
import toast from "react-hot-toast";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct, TProductStyling } from "@formbricks/types/product";
import { TBaseStyling } from "@formbricks/types/styling";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
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
import { BackgroundStylingCard } from "./BackgroundStylingCard";
import { CardStylingSettings } from "./CardStylingSettings";
import { FormStylingSettings } from "./FormStylingSettings";

type StylingViewProps = {
  environment: TEnvironment;
  product: TProduct;
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  colors: string[];
  styling: TSurveyStyling | null;
  setStyling: React.Dispatch<React.SetStateAction<TSurveyStyling | null>>;
  localStylingChanges: TSurveyStyling | null;
  setLocalStylingChanges: React.Dispatch<React.SetStateAction<TSurveyStyling | null>>;
  isUnsplashConfigured: boolean;
};

export const StylingView = ({
  colors,
  environment,
  product,
  localSurvey,
  setLocalSurvey,
  setStyling,
  styling,
  localStylingChanges,
  setLocalStylingChanges,
  isUnsplashConfigured,
}: StylingViewProps) => {
  const stylingDefaults: TBaseStyling = useMemo(() => {
    let stylingDefaults: TBaseStyling;
    const isOverwriteEnabled = localSurvey.styling?.overwriteThemeStyling ?? false;

    if (isOverwriteEnabled) {
      const { overwriteThemeStyling, ...baseSurveyStyles } = localSurvey.styling ?? {};
      stylingDefaults = baseSurveyStyles;
    } else {
      const { allowStyleOverwrite, ...baseProductStyles } = product.styling ?? {};
      stylingDefaults = baseProductStyles;
    }

    return {
      brandColor: { light: stylingDefaults.brandColor?.light ?? COLOR_DEFAULTS.brandColor },
      questionColor: { light: stylingDefaults.questionColor?.light ?? COLOR_DEFAULTS.questionColor },
      inputColor: { light: stylingDefaults.inputColor?.light ?? COLOR_DEFAULTS.inputColor },
      inputBorderColor: { light: stylingDefaults.inputBorderColor?.light ?? COLOR_DEFAULTS.inputBorderColor },
      cardBackgroundColor: {
        light: stylingDefaults.cardBackgroundColor?.light ?? COLOR_DEFAULTS.cardBackgroundColor,
      },
      cardBorderColor: { light: stylingDefaults.cardBorderColor?.light ?? COLOR_DEFAULTS.cardBorderColor },
      cardShadowColor: { light: stylingDefaults.cardShadowColor?.light ?? COLOR_DEFAULTS.cardShadowColor },
      highlightBorderColor: stylingDefaults.highlightBorderColor?.light
        ? {
            light: stylingDefaults.highlightBorderColor.light,
          }
        : undefined,
      isDarkModeEnabled: stylingDefaults.isDarkModeEnabled ?? false,
      roundness: stylingDefaults.roundness ?? 8,
      cardArrangement: stylingDefaults.cardArrangement ?? {
        linkSurveys: "simple",
        appSurveys: "simple",
      },
      background: stylingDefaults.background,
      hideProgressBar: stylingDefaults.hideProgressBar ?? false,
      isLogoHidden: stylingDefaults.isLogoHidden ?? false,
    };
  }, [localSurvey.styling, product.styling]);

  const form = useForm<TSurveyStyling>({
    defaultValues: {
      ...localSurvey.styling,
      ...stylingDefaults,
    },
  });

  const overwriteThemeStyling = form.watch("overwriteThemeStyling");
  const setOverwriteThemeStyling = (value: boolean) => form.setValue("overwriteThemeStyling", value);

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [stylingOpen, setStylingOpen] = useState(false);
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);

  const onResetThemeStyling = () => {
    const { styling: productStyling } = product;
    const { allowStyleOverwrite, ...baseStyling } = productStyling ?? {};

    setStyling({
      ...baseStyling,
      overwriteThemeStyling: true,
    });

    form.reset({
      ...baseStyling,
      overwriteThemeStyling: true,
    });

    setConfirmResetStylingModalOpen(false);
    toast.success("Styling set to theme styles");
  };

  useEffect(() => {
    if (!overwriteThemeStyling) {
      setFormStylingOpen(false);
      setCardStylingOpen(false);
      setStylingOpen(false);
    }
  }, [overwriteThemeStyling]);

  const watchedValues = useWatch({
    control: form.control,
  });

  useEffect(() => {
    // @ts-expect-error
    setLocalSurvey((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        ...watchedValues,
      },
    }));
  }, [watchedValues, setLocalSurvey]);

  const defaultProductStyling = useMemo(() => {
    const { styling: productStyling } = product;
    const { allowStyleOverwrite, ...baseStyling } = productStyling ?? {};

    return baseStyling;
  }, [product]);

  const handleOverwriteToggle = (value: boolean) => {
    // survey styling from the server is surveyStyling, it could either be set or not
    // if its set and the toggle is turned off, we set the local styling to the server styling

    setOverwriteThemeStyling(value);

    // if the toggle is turned on, we set the local styling to the product styling
    if (value) {
      if (!styling) {
        // copy the product styling to the survey styling
        setStyling({
          ...defaultProductStyling,
          overwriteThemeStyling: true,
        });
        return;
      }

      // if there are local styling changes, we set the styling to the local styling changes that were previously stored
      if (localStylingChanges) {
        setStyling(localStylingChanges);
      }
      // if there are no local styling changes, we set the styling to the product styling
      else {
        setStyling({
          ...defaultProductStyling,
          overwriteThemeStyling: true,
        });
      }
    }

    // if the toggle is turned off, we store the local styling changes and set the styling to the product styling
    else {
      // copy the styling to localStylingChanges
      setLocalStylingChanges(styling);

      // copy the product styling to the survey styling
      setStyling({
        ...defaultProductStyling,
        overwriteThemeStyling: false,
      });
    }
  };

  return (
    <FormProvider {...form}>
      <form onSubmit={(e) => e.preventDefault()}>
        <div className="mt-12 space-y-3 p-5">
          <div className="flex items-center gap-4 py-4">
            <FormField
              control={form.control}
              name="overwriteThemeStyling"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Switch checked={!!field.value} onCheckedChange={handleOverwriteToggle} />
                  </FormControl>

                  <div>
                    <FormLabel className="text-base font-semibold text-slate-900">
                      Add custom styles
                    </FormLabel>
                    <FormDescription className="text-sm text-slate-800">
                      Override the theme with individual styles for this survey.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>

          <FormStylingSettings
            open={formStylingOpen}
            setOpen={setFormStylingOpen}
            disabled={!overwriteThemeStyling}
            form={form as UseFormReturn<TProductStyling | TSurveyStyling>}
          />

          <CardStylingSettings
            open={cardStylingOpen}
            setOpen={setCardStylingOpen}
            surveyType={localSurvey.type}
            disabled={!overwriteThemeStyling}
            product={product}
            form={form as UseFormReturn<TProductStyling | TSurveyStyling>}
          />

          {localSurvey.type === "link" && (
            <BackgroundStylingCard
              open={stylingOpen}
              setOpen={setStylingOpen}
              environmentId={environment.id}
              colors={colors}
              disabled={!overwriteThemeStyling}
              isUnsplashConfigured={isUnsplashConfigured}
              form={form as UseFormReturn<TProductStyling | TSurveyStyling>}
            />
          )}

          <div className="mt-4 flex h-8 items-center justify-between">
            <div>
              {overwriteThemeStyling && (
                <Button
                  type="button"
                  variant="minimal"
                  className="flex items-center gap-2"
                  onClick={() => setConfirmResetStylingModalOpen(true)}>
                  Reset to theme styles
                  <RotateCcwIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-sm text-slate-500">
              Adjust the theme in the{" "}
              <Link
                href={`/environments/${environment.id}/product/look`}
                target="_blank"
                className="font-semibold underline">
                Look & Feel
              </Link>{" "}
              settings
            </p>
          </div>

          <AlertDialog
            open={confirmResetStylingModalOpen}
            setOpen={setConfirmResetStylingModalOpen}
            headerText="Reset to theme styles"
            mainText="Are you sure you want to reset the styling to the theme styles? This will remove all custom styling."
            confirmBtnLabel="Confirm"
            onDecline={() => setConfirmResetStylingModalOpen(false)}
            onConfirm={onResetThemeStyling}
          />
        </div>
      </form>
    </FormProvider>
  );
};

import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { UseFormReturn, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { TEnvironment } from "@formbricks/types/environment";
import { TProduct, TProductStyling } from "@formbricks/types/product";
import { TSurvey, TSurveyStyling } from "@formbricks/types/surveys/types";
import { AlertDialog } from "@formbricks/ui/components/AlertDialog";
import { Button } from "@formbricks/ui/components/Button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormProvider,
} from "@formbricks/ui/components/Form";
import { Switch } from "@formbricks/ui/components/Switch";
import { BackgroundStylingCard } from "./BackgroundStylingCard";
import { CardStylingSettings } from "./CardStylingSettings";
import { FormStylingSettings } from "./FormStylingSettings";

interface StylingViewProps {
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
  isCxMode: boolean;
}

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
  isCxMode,
}: StylingViewProps) => {
  const t = useTranslations();

  const form = useForm<TSurveyStyling>({
    defaultValues: localSurvey.styling ?? product.styling,
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
    toast.success(t("environments.surveys.edit.styling_set_to_theme_styles"));
  };

  useEffect(() => {
    if (!overwriteThemeStyling) {
      setFormStylingOpen(false);
      setCardStylingOpen(false);
      setStylingOpen(false);
    }
  }, [overwriteThemeStyling]);

  useEffect(() => {
    form.watch((data: TSurveyStyling) => {
      setLocalSurvey((prev) => ({
        ...prev,
        styling: {
          ...prev.styling,
          ...data,
        },
      }));
    });
  }, [setLocalSurvey]);

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
          {!isCxMode && (
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
                        {t("environments.surveys.edit.add_custom_styles")}
                      </FormLabel>
                      <FormDescription className="text-sm text-slate-800">
                        {t("environments.surveys.edit.override_theme_with_individual_styles_for_this_survey")}
                      </FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          )}

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

          {!isCxMode && (
            <div className="mt-4 flex h-8 items-center justify-between">
              <div>
                {overwriteThemeStyling && (
                  <Button
                    type="button"
                    variant="minimal"
                    className="flex items-center gap-2"
                    onClick={() => setConfirmResetStylingModalOpen(true)}>
                    {t("environments.surveys.edit.reset_to_theme_styles")}
                    <RotateCcwIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="text-sm text-slate-500">
                {t("environments.surveys.edit.adjust_the_theme_in_the")}{" "}
                <Link
                  href={`/environments/${environment.id}/product/look`}
                  target="_blank"
                  className="font-semibold underline">
                  {t("common.look_and_feel")}
                </Link>{" "}
                {t("common.settings")}
              </p>
            </div>
          )}
          <AlertDialog
            open={confirmResetStylingModalOpen}
            setOpen={setConfirmResetStylingModalOpen}
            headerText={t("environments.surveys.edit.reset_to_theme_styles")}
            mainText={t("environments.surveys.edit.reset_to_theme_styles_main_text")}
            confirmBtnLabel={t("common.confirm")}
            onDecline={() => setConfirmResetStylingModalOpen(false)}
            onConfirm={onResetThemeStyling}
          />
        </div>
      </form>
    </FormProvider>
  );
};

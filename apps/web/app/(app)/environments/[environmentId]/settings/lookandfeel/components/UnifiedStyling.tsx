"use client";

import { UnifiedStylingPreviewSurvey } from "@/app/(app)/environments/[environmentId]/settings/lookandfeel/components/UnifiedStylingPreviewSurvey";
import BackgroundStylingCard from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/BackgroundStylingCard";
import CardStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/CardStylingSettings";
import FormStylingSettings from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/FormStylingSettings";
import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { COLOR_DEFAULTS, PREVIEW_SURVEY } from "@formbricks/lib/styling/constants";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import AlertDialog from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import { Switch } from "@formbricks/ui/Switch";

import { updateProductAction } from "../actions";

type UnifiedStylingProps = {
  product: TProduct;
  environmentId: string;
  colors: string[];
};

interface SurveyStyling {
  background?: {
    bg?: string;
    bgType?: string;
  };
}

interface Survey {
  styling: SurveyStyling;
}

export const UnifiedStyling = ({ product, environmentId, colors }: UnifiedStylingProps) => {
  const router = useRouter();
  const [localProduct, setLocalProduct] = useState(product);
  const [previewSurveyType, setPreviewSurveyType] = useState<"link" | "web">("link");
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);

  const [styling, setStyling] = useState(product.styling);

  const [formStylingOpen, setFormStylingOpen] = useState(false);
  const [cardStylingOpen, setCardStylingOpen] = useState(false);
  const [backgroundStylingOpen, setBackgroundStylingOpen] = useState(false);

  const unifiedStyling = localProduct.styling.unifiedStyling ?? false;
  const setUnifiedStyling = (value: boolean) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        unifiedStyling: value,
      },
    }));
  };

  const allowStyleOverwrite = localProduct.styling.allowStyleOverwrite ?? false;
  const setAllowStyleOverwrite = (value: boolean) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        allowStyleOverwrite: value,
      },
    }));
  };

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  const [styledPreviewSurvey, setStyledPreviewSurvey] = useState<Survey>(PREVIEW_SURVEY);

  useEffect(() => {
    setActiveQuestionId(PREVIEW_SURVEY.questions[0].id);
  }, []);

  useEffect(() => {
    // sync the local product with the product prop
    // TODO: this is not ideal, we should find a better way to do this.
    setLocalProduct(product);
  }, [product]);

  const onSave = useCallback(async () => {
    await updateProductAction(product.id, {
      styling: localProduct.styling,
    });

    toast.success("Styling updated successfully.");
    router.refresh();
  }, [localProduct, product.id, router]);

  const onReset = useCallback(async () => {
    await updateProductAction(product.id, {
      styling: {
        unifiedStyling: true,
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
        highlightBorderColor: undefined,
        isDarkModeEnabled: false,
        roundness: 8,
        cardArrangement: {
          linkSurveys: "simple",
          inAppSurveys: "simple",
        },
      },
    });

    setUnifiedStyling(true);
    setAllowStyleOverwrite(true);

    setStyling({
      unifiedStyling: true,
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
      highlightBorderColor: undefined,
      isDarkModeEnabled: false,
      roundness: 8,
      cardArrangement: {
        linkSurveys: "simple",
        inAppSurveys: "simple",
      },
    });

    // Update the background of the PREVIEW SURVEY
    setStyledPreviewSurvey((currentSurvey) => ({
      ...currentSurvey,
      styling: {
        ...currentSurvey.styling,
        background: {
          ...currentSurvey.styling.background,
          bg: "#ffffff",
          bgType: "color",
        },
      },
    }));

    toast.success("Styling updated successfully.");
    router.refresh();
  }, [product.id, router]);

  useEffect(() => {
    if (!unifiedStyling) {
      setFormStylingOpen(false);
      setCardStylingOpen(false);
    }
  }, [unifiedStyling]);

  useEffect(() => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...styling,
        unifiedStyling,
        allowStyleOverwrite,
      },
    }));
  }, [allowStyleOverwrite, styling, unifiedStyling]);

  return (
    <div className="flex">
      {/* Styling settings */}
      <div className="w-1/2 pr-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-6">
              <Switch
                checked={unifiedStyling}
                onCheckedChange={(value) => {
                  setUnifiedStyling(value);
                }}
              />
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold text-slate-700">Enable unified styling</h3>
                <p className="text-xs text-slate-500">Set base styles for all surveys below</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <Switch
                checked={allowStyleOverwrite}
                onCheckedChange={(value) => {
                  setAllowStyleOverwrite(value);
                }}
                disabled={!unifiedStyling}
              />
              <div className="flex flex-col">
                <h3 className="text-sm font-semibold text-slate-700">Allow overwriting styles</h3>
                <p className="text-xs text-slate-500">
                  Activate if you want some surveys to be styled differently
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 bg-slate-50 p-4">
            <FormStylingSettings
              open={formStylingOpen}
              setOpen={setFormStylingOpen}
              styling={styling}
              setStyling={setStyling}
              disabled={!unifiedStyling}
              hideCheckmark
            />

            <CardStylingSettings
              open={cardStylingOpen}
              setOpen={setCardStylingOpen}
              styling={styling}
              setStyling={setStyling}
              disabled={!unifiedStyling}
              hideCheckmark
            />

            <BackgroundStylingCard
              open={backgroundStylingOpen}
              setOpen={setBackgroundStylingOpen}
              styling={styling}
              setStyling={setStyling}
              environmentId={environmentId}
              colors={colors}
              key={styling.background?.bg}
              hideCheckmark
            />
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2">
          <Button variant="darkCTA" onClick={onSave}>
            Save changes
          </Button>
          <Button
            variant="minimal"
            className="flex items-center gap-2"
            onClick={() => setConfirmResetStylingModalOpen(true)}>
            Reset
            <RotateCcwIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Survey Preview */}

      <div className="relative w-1/2 bg-slate-100 pt-4">
        <div className="sticky top-4 mb-4 h-full max-h-[600px]">
          <UnifiedStylingPreviewSurvey
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            survey={styledPreviewSurvey as TSurvey}
            product={localProduct}
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
  );
};

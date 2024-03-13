"use client";

import { UnifiedStylingPreviewSurvey } from "@/app/(app)/environments/[environmentId]/settings/lookandfeel/components/UnifiedStylingPreviewSurvey";
import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";
import { COLOR_DEFAULTS, PREVIEW_SURVEY } from "@formbricks/lib/styling/constants";
import { mixColor } from "@formbricks/lib/utils";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import AlertDialog from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Slider } from "@formbricks/ui/Slider";
import { ColorSelectorWithLabel } from "@formbricks/ui/Styling";
import { Switch } from "@formbricks/ui/Switch";

import { updateProductAction } from "../actions";

type UnifiedStylingProps = {
  product: TProduct;
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

export const UnifiedStyling = ({ product }: UnifiedStylingProps) => {
  const router = useRouter();
  const [localProduct, setLocalProduct] = useState(product);
  const [previewSurveyType, setPreviewSurveyType] = useState<"link" | "web">("link");
  const [confirmResetStylingModalOpen, setConfirmResetStylingModalOpen] = useState(false);

  const highlightBorderColor =
    localProduct.styling.highlightBorderColor?.light || COLOR_DEFAULTS.highlightBorderColor;
  const setHighlightBorderColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        highlightBorderColor: {
          ...(prev.styling.highlightBorderColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const isHighlightBorderAllowed = !!localProduct.styling.highlightBorderColor;
  const setIsHighlightBorderAllowed = useCallback(
    (open: boolean) => {
      if (!open) {
        const { highlightBorderColor, ...rest } = localProduct.styling ?? {};

        setLocalProduct((prev) => ({
          ...prev,
          styling: {
            ...rest,
          },
        }));
      } else {
        setLocalProduct((prev) => ({
          ...prev,
          styling: {
            ...prev.styling,
            highlightBorderColor: {
              ...(prev.styling.highlightBorderColor ?? {}),
              light: highlightBorderColor,
            },
          },
        }));
      }
    },
    [highlightBorderColor, localProduct.styling]
  );

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

  const brandColor = localProduct.styling.brandColor?.light ?? COLOR_DEFAULTS.brandColor;
  const setBrandColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        brandColor: {
          ...(prev.styling.brandColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const questionColor = localProduct.styling.questionColor?.light ?? COLOR_DEFAULTS.questionColor;
  const setQuestionColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        questionColor: {
          ...(prev.styling.questionColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const inputColor = localProduct.styling.inputColor?.light ?? COLOR_DEFAULTS.inputColor;
  const setInputColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        inputColor: {
          ...(prev.styling.inputColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const inputBorderColor = localProduct.styling.inputBorderColor?.light ?? COLOR_DEFAULTS.inputBorderColor;
  const setInputBorderColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        inputBorderColor: {
          ...(prev.styling.inputBorderColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const cardBackgroundColor =
    localProduct.styling.cardBackgroundColor?.light ?? COLOR_DEFAULTS.cardBackgroundColor;
  const setCardBackgroundColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        cardBackgroundColor: {
          ...(prev.styling.cardBackgroundColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const cardBorderColor = localProduct.styling.cardBorderColor?.light ?? COLOR_DEFAULTS.cardBorderColor;
  const setCardBorderColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        cardBorderColor: {
          ...(prev.styling.cardBorderColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const roundness = localProduct.styling.roundness ?? 8;
  const setRoundness = (value: number) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        roundness: value,
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
      styling: {
        unifiedStyling,
        allowStyleOverwrite,
        brandColor: {
          light: brandColor,
        },
        questionColor: {
          light: questionColor,
        },
        inputColor: {
          light: inputColor,
        },
        inputBorderColor: {
          light: inputBorderColor,
        },
        cardBackgroundColor: {
          light: cardBackgroundColor,
        },
        cardBorderColor: {
          light: cardBorderColor,
        },
        highlightBorderColor: isHighlightBorderAllowed
          ? {
              light: highlightBorderColor,
            }
          : undefined,
        isDarkModeEnabled: false,
        roundness,
      },
    });

    toast.success("Styling updated successfully.");
    router.refresh();
  }, [
    allowStyleOverwrite,
    brandColor,
    cardBackgroundColor,
    cardBorderColor,
    highlightBorderColor,
    inputBorderColor,
    inputColor,
    isHighlightBorderAllowed,
    product.id,
    questionColor,
    roundness,
    router,
    unifiedStyling,
  ]);

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
    setBrandColor(COLOR_DEFAULTS.brandColor);
    setQuestionColor(COLOR_DEFAULTS.questionColor);
    setInputColor(COLOR_DEFAULTS.inputColor);
    setInputBorderColor(COLOR_DEFAULTS.inputBorderColor);
    setCardBackgroundColor(COLOR_DEFAULTS.cardBackgroundColor);
    setIsHighlightBorderAllowed(false);
    setRoundness(8);

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
  }, [product.id, router, setIsHighlightBorderAllowed]);

  const suggestColors = useCallback(() => {
    // mix the brand color with different weights of white and set the result as the other colors
    setQuestionColor(mixColor(brandColor, "#000000", 0.35));
    setInputColor(mixColor(brandColor, "#ffffff", 0.9));
    setInputBorderColor(mixColor(brandColor, "#ffffff", 0.6));
    setCardBackgroundColor(mixColor(brandColor, "#ffffff", 0.95));
    setCardBorderColor(mixColor(brandColor, "#ffffff", 0.8));
    if (isHighlightBorderAllowed) {
      setHighlightBorderColor(mixColor(brandColor, "#ffffff", 0.25));
    }

    // Update the background of the PREVIEW SURVEY
    setStyledPreviewSurvey((currentSurvey) => ({
      ...currentSurvey,
      styling: {
        ...currentSurvey.styling,
        background: {
          ...currentSurvey.styling.background,
          bg: mixColor(brandColor, "#ffffff", 0.855),
          bgType: "color",
        },
      },
    }));
  }, [brandColor, isHighlightBorderAllowed]);

  useEffect(() => {
    // when preview survey type is link, we update the highlightBorderColor to undefined
    if (previewSurveyType === "link") {
      setIsHighlightBorderAllowed(false);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewSurveyType]);

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

          <div className="flex flex-col gap-2">
            <ColorSelectorWithLabel
              label="Brand color"
              color={brandColor}
              setColor={setBrandColor}
              description="Change the brand color of the survey"
              className="max-w-full"
              disabled={!unifiedStyling}
            />

            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
              onClick={() => suggestColors()}
              disabled={!unifiedStyling}>
              Suggest colors
            </Button>
          </div>

          <ColorSelectorWithLabel
            label="Text color"
            color={questionColor}
            setColor={setQuestionColor}
            description="Change the text color of the questions, descriptions and answer options."
            className="max-w-full"
            disabled={!unifiedStyling}
          />

          <ColorSelectorWithLabel
            label="Input color"
            color={inputColor}
            setColor={setInputColor}
            className="max-w-full"
            description="Change the background color of the input fields"
            disabled={!unifiedStyling}
          />

          <ColorSelectorWithLabel
            label="Input border color"
            color={inputBorderColor}
            setColor={setInputBorderColor}
            description="Change the border color of the input fields"
            className="max-w-full"
            disabled={!unifiedStyling}
          />

          <ColorSelectorWithLabel
            label="Card background color"
            color={cardBackgroundColor}
            setColor={setCardBackgroundColor}
            description="Change the background color of the card"
            className="max-w-full"
            disabled={!unifiedStyling}
          />

          <ColorSelectorWithLabel
            label="Card border color"
            color={cardBorderColor}
            setColor={setCardBorderColor}
            description="Change the border color of the card"
            className="max-w-full"
            disabled={!unifiedStyling || isHighlightBorderAllowed}
          />

          {previewSurveyType === "web" && (
            <div className={cn("flex flex-col gap-4", !unifiedStyling ? "opacity-40" : "")}>
              <div className="flex items-center gap-6">
                <Switch
                  checked={isHighlightBorderAllowed}
                  onCheckedChange={(value) => {
                    setIsHighlightBorderAllowed(value);
                  }}
                  disabled={!unifiedStyling}
                />
                <div className="flex flex-col">
                  <h3 className="text-sm font-semibold text-slate-700">Add highlight border</h3>
                  <p className="text-xs text-slate-500">Add on outer border to your survey card</p>
                </div>
              </div>

              {isHighlightBorderAllowed && (
                <ColorPicker
                  color={highlightBorderColor}
                  onChange={setHighlightBorderColor}
                  containerClass="my-0"
                  disabled={!unifiedStyling}
                />
              )}
            </div>
          )}

          <div className={cn("flex flex-col gap-4", !unifiedStyling ? "opacity-40" : "")}>
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-slate-700">Roundness</h3>
              <p className="text-xs text-slate-500">Change the border radius of the card and the inputs.</p>
            </div>
            <div className="flex flex-col justify-center rounded-lg border bg-slate-50 p-6">
              <Slider
                value={[roundness]}
                max={22}
                onValueChange={(value) => setRoundness(value[0])}
                disabled={!unifiedStyling}
              />
            </div>
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

"use client";

import UnifiedStylingPreviewSurvey from "@/app/(app)/environments/[environmentId]/settings/lookandfeel/components/UnifiedStylingPreviewSurvey";
import { RotateCcwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import { colorDefaults } from "@formbricks/lib/styling/constants";
import { TProduct } from "@formbricks/types/product";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Slider } from "@formbricks/ui/Slider";
import ColorSelectorWithLabel from "@formbricks/ui/Styling/ColorSelectorWithLabel";
import { Switch } from "@formbricks/ui/Switch";

import { updateProductAction } from "../actions";

type UnifiedStylingProps = {
  product: TProduct;
};

const previewSurvey = {
  id: "cltcppyqk00006uothzb3ybh0",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Product Market Fit (Superhuman)",
  type: "link",
  environmentId: "cltcf8i2n00099wlx7cu12zi6",
  createdBy: "cltcf8i1c00009wlx3sk1ryss",
  status: "draft",
  welcomeCard: {
    html: "Thanks for providing your feedback - let's go!",
    enabled: false,
    headline: "Welcome!",
    timeToFinish: true,
    showResponseCount: false,
  },
  questions: [
    {
      id: "uvnrhtngswxlibktglanh45f",
      type: "openText",
      headline: "This is a preview survey",
      required: true,
      inputType: "text",
      subheader: "Click through it to check the look and feel of the surveying experience.",
      longAnswer: true,
      placeholder: "Type your answer here...",
    },
    {
      id: "swfnndfht0ubsu9uh17tjcej",
      type: "rating",
      range: 5,
      scale: "star",
      headline: "How would you rate My Product",
      required: true,
      subheader: "Don't worry, be honest.",
      lowerLabel: "Not good",
      upperLabel: "Very good",
    },
    {
      id: "je70a714xjdxc70jhxgv5web",
      type: "multipleChoiceSingle",
      choices: [
        {
          id: "vx9q4mlr6ffaw35m99bselwm",
          label: "Eat the cake 🍰",
        },
        {
          id: "ynj051qawxd4dszxkbvahoe5",
          label: "Have the cake 🎂",
        },
      ],
      headline: "What do you do?",
      required: true,
      subheader: "Can't do both.",
      shuffleOption: "none",
    },
  ],
  thankYouCard: {
    enabled: true,
    headline: "Thank you!",
    subheader: "We appreciate your feedback.",
    buttonLink: "https://formbricks.com/signup",
    buttonLabel: "Create your own Survey",
  },
  hiddenFields: {
    enabled: true,
    fieldIds: [],
  },
  displayOption: "displayOnce",
  recontactDays: null,
  autoClose: null,
  closeOnDate: null,
  delay: 0,
  displayPercentage: null,
  autoComplete: null,
  verifyEmail: null,
  redirectUrl: null,
  productOverwrites: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: {
    enabled: false,
    isEncrypted: true,
  },
  pin: null,
  resultShareKey: null,
  triggers: [],
  inlineTriggers: null,
  segment: null,
};

const UnifiedStyling = ({ product }: UnifiedStylingProps) => {
  const router = useRouter();
  const [localProduct, setLocalProduct] = useState(product);
  const [isHighlightBorderAllowed, setIsHighlightBorderAllowed] = useState(false);

  const unifiedStyling = localProduct.styling?.unifiedStyling ?? false;
  const setUnifiedStyling = (value: boolean) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        unifiedStyling: value,
      },
    }));
  };

  const allowStyleOverwrite = localProduct.styling?.allowStyleOverwrite ?? false;
  const setAllowStyleOverwrite = (value: boolean) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        allowStyleOverwrite: value,
      },
    }));
  };

  const brandColor = localProduct.styling?.brandColor?.light ?? colorDefaults.brandColor;
  const setBrandColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        brandColor: {
          ...(prev.styling?.brandColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const questionColor = localProduct.styling?.questionColor?.light ?? colorDefaults.questionColor;
  const setQuestionColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        questionColor: {
          ...(prev.styling?.questionColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const inputColor = localProduct.styling?.inputColor?.light ?? colorDefaults.inputColor;
  const setInputColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        inputColor: {
          ...(prev.styling?.inputColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const inputBorderColor = localProduct.styling?.inputBorderColor?.light ?? colorDefaults.inputBorderColor;
  const setInputBorderColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        inputBorderColor: {
          ...(prev.styling?.inputBorderColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const cardBackgroundColor =
    localProduct.styling?.cardBackgroundColor?.light ?? colorDefaults.cardBackgroundColor;

  const setCardBackgroundColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        cardBackgroundColor: {
          ...(prev.styling?.cardBackgroundColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const highlightBorderColor =
    localProduct.styling?.highlightBorderColor?.light || colorDefaults.highlightBorderColor;
  const setHighlightBorderColor = (color: string) => {
    setLocalProduct((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        highlightBorderColor: {
          ...(prev.styling?.highlightBorderColor ?? {}),
          light: color,
        },
      },
    }));
  };

  const roundness = localProduct.styling?.roundness ?? 8;
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

  useEffect(() => {
    setActiveQuestionId(previewSurvey.questions[0].id);
  }, []);

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
          light: colorDefaults.brandColor,
        },
        questionColor: {
          light: colorDefaults.questionColor,
        },
        inputColor: {
          light: colorDefaults.inputColor,
        },
        inputBorderColor: {
          light: colorDefaults.inputBorderColor,
        },
        cardBackgroundColor: {
          light: colorDefaults.cardBackgroundColor,
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
    setBrandColor(colorDefaults.brandColor);
    setQuestionColor(colorDefaults.questionColor);
    setInputColor(colorDefaults.inputColor);
    setInputBorderColor(colorDefaults.inputBorderColor);
    setCardBackgroundColor(colorDefaults.cardBackgroundColor);
    setIsHighlightBorderAllowed(false);
    setHighlightBorderColor(colorDefaults.highlightBorderColor);
    setRoundness(8);

    toast.success("Styling updated successfully.");
    router.refresh();
  }, [product.id, router]);

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
                <h3 className="text-base font-semibold">Enable unified styling</h3>
                <p className="text-sm text-slate-800">Set base styles for all surveys below</p>
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
                <h3 className="text-base font-semibold">Allow overwriting styles</h3>
                <p className="text-sm text-slate-800">
                  Activate if you want some surveys to be styled differently
                </p>
              </div>
            </div>
          </div>

          <ColorSelectorWithLabel
            label="Brand color"
            color={brandColor}
            setColor={setBrandColor}
            description="Change the brand color of the survey"
            disabled={!unifiedStyling}
          />

          <ColorSelectorWithLabel
            label="Question color"
            color={questionColor}
            setColor={setQuestionColor}
            description="Change the text color of the survey questions."
            disabled={!unifiedStyling}
          />

          <ColorSelectorWithLabel
            label="Input color"
            color={inputColor}
            setColor={setInputColor}
            description="Change the background color of the input fields"
            disabled={!unifiedStyling}
          />

          <ColorSelectorWithLabel
            label="Input border color"
            color={inputBorderColor}
            setColor={setInputBorderColor}
            description="Change the border color of the input fields"
            disabled={!unifiedStyling}
          />

          <ColorSelectorWithLabel
            label="Card background color"
            color={cardBackgroundColor}
            setColor={setCardBackgroundColor}
            description="Change the background color of the card"
            disabled={!unifiedStyling}
          />

          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-6">
              <Switch
                checked={isHighlightBorderAllowed}
                onCheckedChange={(value) => {
                  setIsHighlightBorderAllowed(value);
                }}
                disabled={!unifiedStyling}
              />
              <div className="flex flex-col">
                <h3 className="text-base font-semibold">Add highlight border</h3>
                <p className="text-sm text-slate-800">Add on outer border to your survey card</p>
              </div>
            </div>

            {isHighlightBorderAllowed && (
              <ColorPicker
                color={highlightBorderColor}
                onChange={setHighlightBorderColor}
                containerClass="my-0"
              />
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col">
              <h3 className="text-base font-semibold text-slate-900">Roundness</h3>
              <p className="text-sm text-slate-800">Change the border radius of the card and the inputs.</p>
            </div>

            <Slider
              value={[roundness]}
              max={16}
              onValueChange={(value) => setRoundness(value[0])}
              disabled={!unifiedStyling}
            />
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-2">
          <Button variant="minimal" className="flex items-center gap-2" onClick={onReset}>
            Reset
            <RotateCcwIcon className="h-4 w-4" />
          </Button>

          <Button variant="darkCTA" onClick={onSave}>
            Save changes
          </Button>
        </div>
      </div>

      {/* Survey Preview */}

      <div className="relative w-1/2 bg-slate-100 pt-4">
        <div className="sticky top-0 h-full max-h-[600px]">
          <UnifiedStylingPreviewSurvey
            activeQuestionId={activeQuestionId}
            setActiveQuestionId={setActiveQuestionId}
            survey={previewSurvey as TSurvey}
            product={localProduct}
          />
        </div>
      </div>
    </div>
  );
};

export default UnifiedStyling;

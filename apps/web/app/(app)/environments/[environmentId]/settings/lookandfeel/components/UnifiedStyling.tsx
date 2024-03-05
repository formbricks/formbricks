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
  const [unifiedStyling, setUnifiedStyling] = useState(product.styling?.unifiedStyling ?? false);
  const [allowStyleOverwrite, setAllowStyleOverwrite] = useState(
    product.styling?.allowStyleOverwrite ?? false
  );
  const [brandColor, setBrandColor] = useState(
    product.styling?.brandColor?.light ?? colorDefaults.brandColor
  );
  const [questionColor, setQuestionColor] = useState(
    product.styling?.questionColor?.light ?? colorDefaults.questionColor
  );
  const [inputColor, setInputColor] = useState(
    product.styling?.inputColor?.light ?? colorDefaults.inputColor
  );
  const [inputBorderColor, setInputBorderColor] = useState(
    product.styling?.inputBorderColor?.light ?? colorDefaults.inputBorderColor
  );
  const [cardBackgroundColor, setCardBackgroundColor] = useState(
    product.styling?.cardBackgroundColor?.light ?? colorDefaults.cardBackgroundColor
  );

  const [allowHighlightBorder, setAllowHighlightBorder] = useState(
    !!product.styling?.highlightBorderColor?.light ?? false
  );
  const [highlightBorderColor, setHighlightBorderColor] = useState(
    product.styling?.highlightBorderColor?.light ?? colorDefaults.highlightBorderColor
  );

  // const [isDarkMode, setIsDarkMode] = useState(product.styling?.isDarkModeEnabled ?? false);

  // const [brandColorDark, setBrandColorDark] = useState(product.styling?.brandColor?.dark);

  // const [questionColorDark, setQuestionColorDark] = useState(product.styling?.questionColor?.dark);

  // const [inputColorDark, setInputColorDark] = useState(product.styling?.inputColor?.dark);

  // const [inputBorderColorDark, setInputBorderColorDark] = useState(product.styling?.inputBorderColor?.dark);

  // const [cardBackgroundColorDark, setCardBackgroundColorDark] = useState(
  //   product.styling?.cardBackgroundColor?.dark
  // );

  // const [highlightBorderColorDark, setHighlightBorderColorDark] = useState(
  //   product.styling?.highlightBorderColor?.dark
  // );

  const [roundness, setRoundness] = useState(product.styling?.roundness ?? 8);

  // const [linkSurveysCardArrangement, setLinkSurveysCardArrangement] = useState(
  //   product.styling?.cardArrangement?.linkSurveys ?? "simple"
  // );
  // const [inAppSurveysCardArrangement, setInAppSurveysCardArrangement] = useState(
  //   product.styling?.cardArrangement?.inAppSurveys ?? "simple"
  // );

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);

  useEffect(() => {
    setActiveQuestionId(previewSurvey.questions[0].id);
  }, []);

  useEffect(() => {
    if (!unifiedStyling) {
      setAllowStyleOverwrite(false);
    }
  }, [unifiedStyling]);

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
        highlightBorderColor: allowHighlightBorder
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
    allowHighlightBorder,
    allowStyleOverwrite,
    brandColor,
    cardBackgroundColor,
    highlightBorderColor,
    inputBorderColor,
    inputColor,
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
    setAllowHighlightBorder(false);
    setHighlightBorderColor(colorDefaults.highlightBorderColor);
    // setIsDarkMode(false);
    setRoundness(8);
    // setLinkSurveysCardArrangement("simple");
    // setInAppSurveysCardArrangement("simple");

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
                checked={allowHighlightBorder}
                onCheckedChange={(value) => {
                  setAllowHighlightBorder(value);
                }}
                disabled={!unifiedStyling}
              />
              <div className="flex flex-col">
                <h3 className="text-base font-semibold">Add highlight border</h3>
                <p className="text-sm text-slate-800">Add on outer border to your survey card</p>
              </div>
            </div>

            {allowHighlightBorder && (
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

          {/* These will be tackled later */}

          {/* <DarkModeColors
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            brandColor={brandColorDark}
            cardBackgroundColor={cardBackgroundColorDark}
            highlightBorderColor={highlightBorderColorDark}
            inputBorderColor={inputBorderColorDark}
            inputColor={inputColorDark}
            questionColor={questionColorDark}
            setBrandColor={setBrandColorDark}
            setCardBackgroundColor={setCardBackgroundColorDark}
            setHighlighBorderColor={setHighlightBorderColorDark}
            setInputBorderColor={setInputBorderColorDark}
            setInputColor={setInputColorDark}
            setQuestionColor={setQuestionColorDark}
            disabled={!unifiedStyling}
          /> */}

          {/* <CardArrangement
            activeCardArrangement={linkSurveysCardArrangement}
            surveyType="link"
            setActiveCardArrangement={setLinkSurveysCardArrangement}
            disabled={!unifiedStyling}
          />

          <CardArrangement
            activeCardArrangement={inAppSurveysCardArrangement}
            surveyType="web"
            setActiveCardArrangement={setInAppSurveysCardArrangement}
            disabled={!unifiedStyling}
          /> */}
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
            product={product}
          />
        </div>
      </div>
    </div>
  );
};

export default UnifiedStyling;

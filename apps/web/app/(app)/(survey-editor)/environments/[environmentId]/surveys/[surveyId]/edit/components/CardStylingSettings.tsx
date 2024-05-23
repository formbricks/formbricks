"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import React, { useMemo } from "react";

import { cn } from "@formbricks/lib/cn";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { TProduct, TProductStyling } from "@formbricks/types/product";
import { TCardArrangementOptions } from "@formbricks/types/styling";
import { TSurveyStyling, TSurveyType } from "@formbricks/types/surveys";
import { Badge } from "@formbricks/ui/Badge";
import { ColorPicker } from "@formbricks/ui/ColorPicker";
import { Label } from "@formbricks/ui/Label";
import { Slider } from "@formbricks/ui/Slider";
import { CardArrangement, ColorSelectorWithLabel } from "@formbricks/ui/Styling";
import { Switch } from "@formbricks/ui/Switch";

type CardStylingSettingsProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  styling: TSurveyStyling | TProductStyling | null;
  setStyling: React.Dispatch<React.SetStateAction<TSurveyStyling | TProductStyling>>;
  isSettingsPage?: boolean;
  surveyType?: TSurveyType;
  disabled?: boolean;
  localProduct: TProduct;
};

export const CardStylingSettings = ({
  setStyling,
  styling,
  isSettingsPage = false,
  surveyType,
  disabled,
  open,
  localProduct,
  setOpen,
}: CardStylingSettingsProps) => {
  const isAppSurvey = surveyType === "app" || surveyType === "website";
  const cardBgColor = styling?.cardBackgroundColor?.light || COLOR_DEFAULTS.cardBackgroundColor;

  const isLogoHidden = styling?.isLogoHidden ?? false;

  const isLogoVisible = !!localProduct.logo?.url;

  const linkSurveyCardArrangement = styling?.cardArrangement?.linkSurveys ?? "straight";

  const inAppSurveyCardArrangement = styling?.cardArrangement?.appSurveys ?? "straight";

  const setCardBgColor = (color: string) => {
    setStyling((prev) => ({
      ...prev,
      cardBackgroundColor: {
        ...(prev.cardBackgroundColor ?? {}),
        light: color,
      },
    }));
  };

  const cardBorderColor = styling?.cardBorderColor?.light || COLOR_DEFAULTS.cardBorderColor;
  const setCardBorderColor = (color: string) => {
    setStyling((prev) => ({
      ...prev,
      cardBorderColor: {
        ...(prev.cardBorderColor ?? {}),
        light: color,
      },
    }));
  };

  const cardShadowColor = styling?.cardShadowColor?.light || COLOR_DEFAULTS.cardShadowColor;
  const setCardShadowColor = (color: string) => {
    setStyling((prev) => ({
      ...prev,
      cardShadowColor: {
        ...(prev.cardShadowColor ?? {}),
        light: color,
      },
    }));
  };

  const isHighlightBorderAllowed = !!styling?.highlightBorderColor;
  const setIsHighlightBorderAllowed = (open: boolean) => {
    if (!open) {
      const { highlightBorderColor, ...rest } = styling ?? {};

      setStyling({
        ...rest,
      });
    } else {
      setStyling((prev) => ({
        ...prev,
        highlightBorderColor: {
          ...(prev.highlightBorderColor ?? {}),
          light: COLOR_DEFAULTS.highlightBorderColor,
        },
      }));
    }
  };

  const highlightBorderColor = styling?.highlightBorderColor?.light || COLOR_DEFAULTS.highlightBorderColor;
  const setHighlightBorderColor = (color: string) => {
    setStyling((prev) => ({
      ...prev,
      highlightBorderColor: {
        ...(prev.highlightBorderColor ?? {}),
        light: color,
      },
    }));
  };

  const roundness = styling?.roundness ?? 8;
  const setRoundness = (value: number) => {
    setStyling((prev) => ({
      ...prev,
      roundness: value,
    }));
  };

  const setCardArrangement = (arrangement: TCardArrangementOptions, surveyType: TSurveyType) => {
    const newCardArrangement = {
      linkSurveys: linkSurveyCardArrangement,
      appSurveys: inAppSurveyCardArrangement,
    };

    if (surveyType === "link") {
      newCardArrangement.linkSurveys = arrangement;
    } else if (surveyType === "app" || surveyType === "website") {
      newCardArrangement.appSurveys = arrangement;
    }

    setStyling((prev) => ({
      ...prev,
      cardArrangement: newCardArrangement,
    }));
  };

  const toggleProgressBarVisibility = (hideProgressBar: boolean) => {
    setStyling({
      ...styling,
      hideProgressBar,
    });
  };

  const toggleLogoVisibility = () => {
    setStyling((prev) => ({
      ...prev,
      isLogoHidden: !prev.isLogoHidden,
    }));
  };

  const hideProgressBar = useMemo(() => {
    return styling?.hideProgressBar;
  }, [styling]);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (disabled) return;
        setOpen(openState);
      }}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        disabled={disabled}
        className={cn(
          "w-full cursor-pointer rounded-lg hover:bg-slate-50",
          disabled && "cursor-not-allowed opacity-60 hover:bg-white"
        )}>
        <div className="inline-flex px-4 py-4">
          {!isSettingsPage && (
            <div className="flex items-center pl-2 pr-5">
              <CheckIcon
                strokeWidth={3}
                className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              />
            </div>
          )}

          <div>
            <p className={cn("font-semibold text-slate-800", isSettingsPage ? "text-sm" : "text-base")}>
              Card Styling
            </p>
            <p className={cn("mt-1 text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
              Style the survey card.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-6 p-6 pt-2">
          <div className="flex max-w-xs flex-col gap-4">
            <div className="flex flex-col">
              <h3 className="text-sm font-semibold text-slate-700">Roundness</h3>
              <p className="text-xs text-slate-500">Change the border radius of the card and the inputs.</p>
            </div>
            <div className="flex flex-col justify-center rounded-lg border bg-slate-50 p-6">
              <Slider value={[roundness]} max={22} onValueChange={(value) => setRoundness(value[0])} />
            </div>
          </div>

          <ColorSelectorWithLabel
            label="Card background color"
            color={cardBgColor}
            setColor={setCardBgColor}
            description="Change the background color of the card."
          />

          <ColorSelectorWithLabel
            label="Card border color"
            color={cardBorderColor}
            setColor={setCardBorderColor}
            description="Change the border color of the card."
          />

          <ColorSelectorWithLabel
            label="Card shadow color"
            color={cardShadowColor}
            setColor={setCardShadowColor}
            description="Change the shadow color of the card."
          />

          <CardArrangement
            surveyType={isAppSurvey ? "app" : "link"}
            activeCardArrangement={isAppSurvey ? inAppSurveyCardArrangement : linkSurveyCardArrangement}
            setActiveCardArrangement={setCardArrangement}
          />

          <>
            <div className="flex items-center space-x-1">
              <Switch
                id="hideProgressBar"
                checked={!!hideProgressBar}
                onCheckedChange={(checked) => toggleProgressBarVisibility(checked)}
              />
              <Label htmlFor="hideProgressBar" className="cursor-pointer">
                <div className="ml-2">
                  <h3 className="text-sm font-semibold text-slate-700">Hide progress bar</h3>
                  <p className="text-xs font-normal text-slate-500">
                    Disable the visibility of survey progress.
                  </p>
                </div>
              </Label>
            </div>

            {isLogoVisible && (!surveyType || surveyType === "link") && !isSettingsPage && (
              <div className="flex items-center space-x-1">
                <Switch id="isLogoHidden" checked={isLogoHidden} onCheckedChange={toggleLogoVisibility} />
                <Label htmlFor="isLogoHidden" className="cursor-pointer">
                  <div className="ml-2 flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-slate-700">Hide logo</h3>
                      <Badge text="Link Surveys" type="gray" size="normal" />
                    </div>
                    <p className="text-xs font-normal text-slate-500">
                      Hides the logo in this specific survey
                    </p>
                  </div>
                </Label>
              </div>
            )}

            {(!surveyType || isAppSurvey) && (
              <div className="flex max-w-xs flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={isHighlightBorderAllowed} onCheckedChange={setIsHighlightBorderAllowed} />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="whitespace-nowrap text-sm font-semibold text-slate-700">
                        Add highlight border
                      </h3>
                      <Badge
                        text="App & Website Surveys"
                        type="gray"
                        size="normal"
                        className="whitespace-nowrap"
                      />
                    </div>
                    <p className="text-xs text-slate-500">Add an outer border to your survey card.</p>
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
            )}
          </>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

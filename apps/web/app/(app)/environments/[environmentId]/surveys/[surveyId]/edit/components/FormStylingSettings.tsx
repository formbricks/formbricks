"use client";

import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import React from "react";

import { cn } from "@formbricks/lib/cn";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { mixColor } from "@formbricks/lib/utils";
import { TSurvey } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { ColorSelectorWithLabel } from "@formbricks/ui/Styling";

type FormStylingSettingsProps = {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  disabled?: boolean;
};

const FormStylingSettings = ({
  localSurvey,
  setLocalSurvey,
  disabled = false,
  open,
  setOpen,
}: FormStylingSettingsProps) => {
  const brandColor = localSurvey.styling?.brandColor?.light || COLOR_DEFAULTS.brandColor;
  const setBrandColor = (color: string) => {
    setLocalSurvey((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        brandColor: {
          light: color,
        },
      },
    }));
  };

  const questionColor = localSurvey.styling?.questionColor?.light || COLOR_DEFAULTS.questionColor;
  const setQuestionColor = (color: string) => {
    setLocalSurvey((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        questionColor: {
          light: color,
        },
      },
    }));
  };

  const inputColor = localSurvey.styling?.inputColor?.light || COLOR_DEFAULTS.inputColor;
  const setInputColor = (color: string) => {
    setLocalSurvey((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        inputColor: {
          light: color,
        },
      },
    }));
  };

  const inputBorderColor = localSurvey.styling?.inputBorderColor?.light || COLOR_DEFAULTS.inputBorderColor;
  const setInputBorderColor = (color: string) => {
    setLocalSurvey((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        inputBorderColor: {
          light: color,
        },
      },
    }));
  };

  const suggestColors = () => {
    // mix the brand color with different weights of white and set the result as the other colors
    setQuestionColor(mixColor(brandColor, "#000000", 0.2));
    setInputColor(mixColor(brandColor, "#ffffff", 0.8));
    setInputBorderColor(mixColor(brandColor, "#ffffff", 0.6));

    // card background:
    setLocalSurvey((prev) => ({
      ...prev,
      styling: {
        ...prev.styling,
        cardBackgroundColor: {
          ...(prev.styling?.cardBackgroundColor ?? {}),
          light: mixColor(brandColor, "#ffffff", 0.9),
        },
      },
    }));

    if (localSurvey.styling?.highlightBorderColor) {
      setLocalSurvey((prev) => ({
        ...prev,
        styling: {
          ...prev.styling,
          highlightBorderColor: {
            ...(prev.styling?.highlightBorderColor ?? {}),
            light: mixColor(brandColor, "#ffffff", 0.7),
          },
        },
      }));
    }
  };

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
          "h-full w-full cursor-pointer rounded-lg hover:bg-slate-50",
          disabled && "cursor-not-allowed opacity-60 hover:bg-white"
        )}>
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>

          <div>
            <p className="font-semibold text-slate-800">Form Styling</p>
            <p className="mt-1 text-sm text-slate-500">
              Style the question texts, descriptions and input fields.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-6 p-6 pt-2">
          <div className="flex flex-col gap-2">
            <ColorSelectorWithLabel
              label="Brand color"
              color={brandColor}
              setColor={setBrandColor}
              description="Change the brand color of the survey"
            />

            <Button variant="secondary" size="sm" className="w-fit" onClick={() => suggestColors()}>
              Suggest colors
            </Button>
          </div>

          <ColorSelectorWithLabel
            label="Text color"
            color={questionColor}
            setColor={setQuestionColor}
            description="Change the text color of the questions, descriptions and answer options."
          />

          <ColorSelectorWithLabel
            label="Input color"
            color={inputColor}
            setColor={setInputColor}
            description="Change the background color of the input fields"
          />

          <ColorSelectorWithLabel
            label="Input border color"
            color={inputBorderColor}
            setColor={setInputBorderColor}
            description="Change the border color of the input fields"
          />
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

export default FormStylingSettings;

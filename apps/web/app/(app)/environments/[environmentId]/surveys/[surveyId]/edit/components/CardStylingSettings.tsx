"use client";

import { CheckCircleIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import React, { useState } from "react";

import { colorDefaults } from "@formbricks/lib/styling/constants";
import { TSurvey } from "@formbricks/types/surveys";
import ColorSelectorWithLabel from "@formbricks/ui/Styling/ColorSelectorWithLabel";

type CardStylingSettingsProps = {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
};

const CardStylingSettings = ({ localSurvey, setLocalSurvey }: CardStylingSettingsProps) => {
  const [open, setOpen] = useState(false);

  const cardBgColor = localSurvey.styling?.cardBackgroundColor?.light || colorDefaults.cardBackgroundColor;
  const setCardBgColor = (color: string) => {
    setLocalSurvey((prev) => ({
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

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        setOpen(openState);
      }}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
            {/* {containsEmptyTriggers ? (
                <div className="h-8 w-8 rounded-full border border-amber-500 bg-amber-50" />
              ) : (
                <CheckCircleIcon className="h-8 w-8 text-green-400" />
              )} */}
          </div>

          <div>
            <p className="font-semibold text-slate-800">Card Styling</p>
            <p className="mt-1 text-sm text-slate-500">Style the survey card.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-6 p-6 pt-2">
          <ColorSelectorWithLabel
            label="Brand color"
            color={cardBgColor}
            setColor={setCardBgColor}
            description="Change the brand color of the survey"
          />
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

export default CardStylingSettings;

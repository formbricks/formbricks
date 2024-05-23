"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";

import { cn } from "@formbricks/lib/cn";
import { TProductStyling } from "@formbricks/types/product";
import { TSurveyBackgroundBgType, TSurveyStyling } from "@formbricks/types/surveys";
import { Badge } from "@formbricks/ui/Badge";
import { Slider } from "@formbricks/ui/Slider";

import { SurveyBgSelectorTab } from "./SurveyBgSelectorTab";

interface BackgroundStylingCardProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  styling: TSurveyStyling | TProductStyling | null;
  setStyling: React.Dispatch<React.SetStateAction<TSurveyStyling | TProductStyling>>;
  colors: string[];
  isSettingsPage?: boolean;
  disabled?: boolean;
  environmentId: string;
  isUnsplashConfigured: boolean;
}

export const BackgroundStylingCard = ({
  open,
  setOpen,
  styling,
  setStyling,
  colors,
  isSettingsPage = false,
  disabled,
  environmentId,
  isUnsplashConfigured,
}: BackgroundStylingCardProps) => {
  const { bgType, brightness } = styling?.background ?? {};

  const handleBgChange = (color: string, type: TSurveyBackgroundBgType) => {
    const { background } = styling ?? {};

    setStyling({
      ...styling,
      background: {
        ...background,
        bg: color,
        bgType: type,
        brightness: 100,
      },
    });
  };

  const handleBrightnessChange = (percent: number) => {
    setStyling((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        brightness: percent,
      },
    }));
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (disabled) return;
        setOpen(openState);
      }}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white "
      )}>
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
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <p className={cn("font-semibold text-slate-800", isSettingsPage ? "text-sm" : "text-base")}>
                Background Styling
              </p>
              {isSettingsPage && <Badge text="Link Surveys" type="gray" size="normal" />}
            </div>
            <p className={cn("mt-1 text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
              Change the background to a color, image or animation.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="flex flex-col gap-3 p-3">
          {/* Background */}
          <div className="p-3">
            <div className="ml-2">
              <h3 className="text-sm font-semibold text-slate-700">Change background</h3>
              <p className="text-xs font-normal text-slate-500">
                Pick a background from our library or upload your own.
              </p>
            </div>
            <SurveyBgSelectorTab
              styling={styling}
              handleBgChange={handleBgChange}
              colors={colors}
              bgType={bgType}
              environmentId={environmentId}
              isUnsplashConfigured={isUnsplashConfigured}
            />
          </div>

          {/* Overlay */}
          <div className="flex flex-col gap-4 p-3">
            <div className="ml-2">
              <h3 className="text-sm font-semibold text-slate-700">Background overlay</h3>
              <p className="text-xs font-normal text-slate-500">
                Darken or lighten background of your choice.
              </p>
            </div>

            <div>
              <div className="ml-2 flex flex-col justify-center">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col justify-center rounded-lg border bg-slate-50 p-6">
                    <Slider
                      value={[brightness ?? 100]}
                      max={200}
                      onValueChange={(value) => {
                        handleBrightnessChange(value[0]);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

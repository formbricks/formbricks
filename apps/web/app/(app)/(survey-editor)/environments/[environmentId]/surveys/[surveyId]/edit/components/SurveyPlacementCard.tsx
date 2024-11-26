"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TPlacement } from "@formbricks/types/common";
import { TSurvey, TSurveyProductOverwrites } from "@formbricks/types/surveys/types";
import { Label } from "@formbricks/ui/Label";
import { Switch } from "@formbricks/ui/Switch";
import { Placement } from "./Placement";

interface SurveyPlacementCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
  environmentId: string;
}

export const SurveyPlacementCard = ({
  localSurvey,
  setLocalSurvey,
  environmentId,
}: SurveyPlacementCardProps) => {
  const [open, setOpen] = useState(false);

  const { productOverwrites } = localSurvey ?? {};
  const { placement, clickOutsideClose, darkOverlay } = productOverwrites ?? {};

  const setProductOverwrites = (productOverwrites: TSurveyProductOverwrites) => {
    setLocalSurvey({ ...localSurvey, productOverwrites });
  };

  const togglePlacement = () => {
    if (setProductOverwrites) {
      setProductOverwrites({
        ...productOverwrites,
        placement: !!placement ? null : "bottomRight",
        clickOutsideClose: false,
        darkOverlay: false,
      });
    }
  };

  const handlePlacementChange = (placement: TPlacement) => {
    if (setProductOverwrites) {
      setProductOverwrites({
        ...productOverwrites,
        placement,
      });
    }
  };

  const handleOverlay = (overlayType: string) => {
    const darkOverlay = overlayType === "dark";

    if (setProductOverwrites) {
      setProductOverwrites({
        ...productOverwrites,
        darkOverlay,
      });
    }
  };

  const handleClickOutsideClose = (clickOutsideClose: boolean) => {
    if (setProductOverwrites) {
      setProductOverwrites({
        ...productOverwrites,
        clickOutsideClose,
      });
    }
  };

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (localSurvey.type !== "link") {
          setOpen(openState);
        }
      }}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
            />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Survey Placement</p>
            <p className="mt-1 text-sm text-slate-500">Overwrite the global placement of the survey</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="pb-3">
        <hr className="py-1 text-slate-600" />
        <div className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-1">
              <Switch id="surveyDeadline" checked={!!placement} onCheckedChange={togglePlacement} />
              <Label htmlFor="surveyDeadline" className="cursor-pointer">
                <div className="ml-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-700">Overwrite Placement</h3>
                  </div>
                  <p className="text-xs font-normal text-slate-500">Change the placement of this survey.</p>
                </div>
              </Label>
            </div>
            {placement && (
              <div className="flex items-center space-x-1 pb-4">
                <div className="flex w-full cursor-pointer items-center rounded-lg border bg-slate-50 p-4">
                  <div className="w-full items-center">
                    <Placement
                      currentPlacement={placement}
                      setCurrentPlacement={handlePlacementChange}
                      setOverlay={handleOverlay}
                      overlay={darkOverlay ? "dark" : "light"}
                      setClickOutsideClose={handleClickOutsideClose}
                      clickOutsideClose={!!clickOutsideClose}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-slate-500">
                To keep the placement over all surveys consistent, you can{" "}
                <Link href={`/environments/${environmentId}/product/look`} target="_blank">
                  <span className="underline">set the global placement in the Look & Feel settings.</span>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

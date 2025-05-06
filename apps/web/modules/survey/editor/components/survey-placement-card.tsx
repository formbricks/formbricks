"use client";

import { Placement } from "@/modules/survey/editor/components/placement";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TPlacement } from "@formbricks/types/common";
import { TSurvey, TSurveyProjectOverwrites } from "@formbricks/types/surveys/types";

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
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);

  const { projectOverwrites } = localSurvey ?? {};
  const { placement, clickOutsideClose, darkOverlay } = projectOverwrites ?? {};

  const setProjectOverwrites = (projectOverwrites: TSurveyProjectOverwrites | null) => {
    setLocalSurvey({ ...localSurvey, projectOverwrites: projectOverwrites });
  };

  const togglePlacement = () => {
    if (setProjectOverwrites) {
      if (placement) {
        setProjectOverwrites(null);
      } else {
        setProjectOverwrites({
          placement: "bottomRight",
          clickOutsideClose: false,
          darkOverlay: false,
        });
      }
    }
  };

  const handlePlacementChange = (placement: TPlacement) => {
    if (setProjectOverwrites) {
      setProjectOverwrites({
        ...projectOverwrites,
        placement,
      });
    }
  };

  const handleOverlay = (overlayType: string) => {
    const darkOverlay = overlayType === "dark";

    if (setProjectOverwrites) {
      setProjectOverwrites({
        ...projectOverwrites,
        darkOverlay,
      });
    }
  };

  const handleClickOutsideClose = (clickOutsideClose: boolean) => {
    if (setProjectOverwrites) {
      setProjectOverwrites({
        ...projectOverwrites,
        clickOutsideClose,
      });
    }
  };

  const [parent] = useAutoAnimate();

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
            <p className="font-semibold text-slate-800">{t("environments.surveys.edit.survey_placement")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("environments.surveys.edit.overwrite_the_global_placement_of_the_survey")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className={`flex ${open && "pb-3"}`} ref={parent}>
        <hr className="py-1 text-slate-600" />
        <div className="p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center space-x-1">
              <Switch id="surveyDeadline" checked={!!placement} onCheckedChange={togglePlacement} />
              <Label htmlFor="surveyDeadline" className="cursor-pointer">
                <div className="ml-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-700">
                      {t("environments.surveys.edit.overwrite_placement")}
                    </h3>
                  </div>
                  <p className="text-xs font-normal text-slate-500">
                    {t("environments.surveys.edit.change_the_placement_of_this_survey")}
                  </p>
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
                {t("environments.surveys.edit.to_keep_the_placement_over_all_surveys_consistent_you_can")}{" "}
                <Link href={`/environments/${environmentId}/project/look`} target="_blank">
                  <span className="underline">
                    {t("environments.surveys.edit.set_the_global_placement_in_the_look_feel_settings")}
                  </span>
                </Link>
              </p>
            </div>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

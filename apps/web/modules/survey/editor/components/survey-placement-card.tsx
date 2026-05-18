"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { TOverlay, TPlacement } from "@formbricks/types/common";
import { TSurvey, TSurveyWorkspaceOverwrites } from "@formbricks/types/surveys/types";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { Placement } from "@/modules/survey/editor/components/placement";
import { Label } from "@/modules/ui/components/label";
import { Switch } from "@/modules/ui/components/switch";

interface SurveyPlacementCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: (survey: TSurvey) => void;
}

export const SurveyPlacementCard = ({ localSurvey, setLocalSurvey }: SurveyPlacementCardProps) => {
  const { workspace } = useWorkspace();
  const workspaceBasePath = `/workspaces/${workspace?.id}`;
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const { workspaceOverwrites } = localSurvey ?? {};
  const { placement, clickOutsideClose, overlay } = workspaceOverwrites ?? {};

  const setWorkspaceOverwrites = (workspaceOverwrites: TSurveyWorkspaceOverwrites | null) => {
    setLocalSurvey({ ...localSurvey, workspaceOverwrites: workspaceOverwrites });
  };

  const togglePlacement = () => {
    if (setWorkspaceOverwrites) {
      if (placement) {
        setWorkspaceOverwrites(null);
      } else {
        setWorkspaceOverwrites({
          placement: "bottomRight",
          clickOutsideClose: false,
          overlay: "none",
        });
      }
    }
  };

  const handlePlacementChange = (placement: TPlacement) => {
    if (setWorkspaceOverwrites) {
      setWorkspaceOverwrites({
        ...workspaceOverwrites,
        placement,
      });
    }
  };

  const handleOverlay = (overlayValue: TOverlay) => {
    if (setWorkspaceOverwrites) {
      setWorkspaceOverwrites({
        ...workspaceOverwrites,
        overlay: overlayValue,
      });
    }
  };

  const handleClickOutsideClose = (clickOutsideClose: boolean) => {
    if (setWorkspaceOverwrites) {
      setWorkspaceOverwrites({
        ...workspaceOverwrites,
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
            <p className="font-semibold text-slate-800">{t("workspace.surveys.edit.survey_placement")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("workspace.surveys.edit.overwrite_the_global_placement_of_the_survey")}
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
                      {t("workspace.surveys.edit.overwrite_placement")}
                    </h3>
                  </div>
                  <p className="text-xs font-normal text-slate-500">
                    {t("workspace.surveys.edit.change_the_placement_of_this_survey")}
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
                      overlay={overlay ?? "none"}
                      setClickOutsideClose={handleClickOutsideClose}
                      clickOutsideClose={!!clickOutsideClose}
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-xs text-slate-500">
                <Trans
                  i18nKey="workspace.surveys.edit.set_global_placement_in_look_feel_settings_hint"
                  components={{
                    lookFeelLink: (
                      <Link href={`${workspaceBasePath}/look`} target="_blank" className="underline" />
                    ),
                  }}
                />
              </p>
            </div>
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

"use client";

import {
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  PencilIcon,
  UserGroupIcon,
} from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import { HardDriveDownloadIcon, HardDriveUploadIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";
import { isAdvancedSegment } from "@formbricks/lib/segment/utils";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TBaseFilter, TSegment } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys";
import AlertDialog from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import BasicAddFilterModal from "@formbricks/ui/Targeting/BasicAddFilterModal";
import BasicSegmentEditor from "@formbricks/ui/Targeting/BasicSegmentEditor";
import LoadSegmentModal from "@formbricks/ui/Targeting/LoadSegmentModal";
import SaveAsNewSegmentModal from "@formbricks/ui/Targeting/SaveAsNewSegmentModal";
import SegmentAlreadyUsedModal from "@formbricks/ui/Targeting/SegmentAlreadyUsedModal";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";

import {
  cloneBasicSegmentAction,
  createBasicSegmentAction,
  loadNewBasicSegmentAction,
  updateBasicSegmentAction,
} from "../actions";
import UserTargetingFallback from "./UserTargetingFallback";

interface UserTargetingCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  environmentId: string;
  attributeClasses: TAttributeClass[];
  segments: TSegment[];
  initialSegment?: TSegment;
}

export default function UserTargetingCard({
  localSurvey,
  setLocalSurvey,
  environmentId,
  attributeClasses,
  segments,
  initialSegment,
}: UserTargetingCardProps) {
  const [segment, setSegment] = useState<TSegment | null>(localSurvey.segment);
  const [open, setOpen] = useState(false);
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [saveAsNewSegmentModalOpen, setSaveAsNewSegmentModalOpen] = useState(false);
  const [isSegmentEditorOpen, setIsSegmentEditorOpen] = useState(!!localSurvey.segment?.isPrivate);
  const [loadSegmentModalOpen, setLoadSegmentModalOpen] = useState(false);
  const [loadSegmentModalStep, setLoadSegmentModalStep] = useState<"initial" | "load">("initial");
  const [resetAllFiltersModalOpen, setResetAllFiltersModalOpen] = useState(false);
  const [segmentEditorViewOnly, setSegmentEditorViewOnly] = useState(true);
  const [segmentUsedModalOpen, setSegmentUsedModalOpen] = useState(false);

  const handleAddFilterInGroup = (filter: TBaseFilter) => {
    const updatedSegment = structuredClone(segment);

    if (updatedSegment?.filters?.length === 0) {
      updatedSegment.filters.push({
        ...filter,
        connector: null,
      });
    } else {
      updatedSegment?.filters.push(filter);
    }

    setSegment(updatedSegment);
  };

  const handleCloneSegment = async () => {
    if (!segment) return;

    try {
      const clonedSegment = await cloneBasicSegmentAction(segment.id, localSurvey.id);
      setSegment(clonedSegment);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleLoadNewSegment = async (surveyId: string, segmentId: string) => {
    const updatedSurvey = await loadNewBasicSegmentAction(surveyId, segmentId);
    return updatedSurvey;
  };

  useEffect(() => {
    if (!!segment && segment?.filters?.length > 0) {
      setOpen(true);
    }
  }, [segment, segment?.filters?.length]);

  useEffect(() => {
    setLocalSurvey((localSurveyOld) => ({
      ...localSurveyOld,
      segment: segment,
    }));
  }, [setLocalSurvey, segment]);

  const isSegmentUsedInOtherSurveys = useMemo(
    () => (localSurvey?.segment ? localSurvey.segment?.surveys?.length > 1 : false),
    [localSurvey.segment]
  );

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className={cn(
        open ? "" : "hover:bg-slate-50",
        "w-full space-y-2 rounded-lg border border-slate-300 bg-white"
      )}>
      <Collapsible.CollapsibleTrigger asChild className="h-full w-full cursor-pointer">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckCircleIcon className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Target Audience</p>
            <p className="mt-1 text-sm text-slate-500">
              Pre-segment your target audience by attribute, action and device.
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent>
        <hr className="py-1 text-slate-600" />
        <div className="flex flex-col gap-2 px-6 pt-2">
          <div className="mb-2">
            <UserTargetingFallback segment={segment} />
          </div>

          <div className="filter-scrollbar flex flex-col gap-4 overflow-auto rounded-lg border border-slate-300 bg-slate-50 p-4">
            <div className="flex w-full flex-col gap-2">
              {isAdvancedSegment(segment?.filters ?? []) ? (
                <div>
                  {!segment?.isPrivate ? (
                    <div className="mb-2 flex items-center gap-6">
                      <UserGroupIcon className="h-6 w-6 text-slate-700" />
                      <div className="flex flex-col">
                        <h3 className="font-medium text-slate-900">{localSurvey.segment?.title}</h3>
                        <p className="text-sm text-slate-500">{localSurvey.segment?.description}</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Send survey to audience who match...
                      </p>
                    </div>
                  )}

                  <p className="text-sm font-semibold text-slate-800">
                    This is an advanced segment, you cannot edit it. Please upgrade your plan!
                  </p>
                </div>
              ) : (
                <>
                  {isSegmentEditorOpen ? (
                    <div className="w-full">
                      <div className="mb-4">
                        {!segment?.isPrivate ? (
                          <div className="mb-2 flex items-center gap-6">
                            <UserGroupIcon className="h-6 w-6 text-slate-700" />
                            <div className="flex flex-col">
                              <h3 className="font-medium text-slate-900">{localSurvey.segment?.title}</h3>
                              <p className="text-sm text-slate-500">{localSurvey.segment?.description}</p>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold text-slate-800">
                              Send survey to audience who match...
                            </p>
                          </div>
                        )}
                      </div>

                      {!!segment?.filters?.length && (
                        <div className="w-full">
                          <BasicSegmentEditor
                            key={segment.filters.toString()}
                            group={segment.filters}
                            environmentId={environmentId}
                            segment={segment}
                            setSegment={setSegment}
                            attributeClasses={attributeClasses}
                          />
                        </div>
                      )}

                      <div className="mt-4 flex items-center gap-4">
                        <Button variant="secondary" size="sm" onClick={() => setAddFilterModalOpen(true)}>
                          Add filter
                        </Button>

                        {isSegmentEditorOpen && !!segment?.filters?.length && (
                          <Button
                            variant="minimal"
                            size="sm"
                            className="flex items-center gap-2"
                            onClick={() => setResetAllFiltersModalOpen(true)}>
                            <p className="text-sm">Reset all filters</p>
                          </Button>
                        )}

                        {isSegmentEditorOpen && !segment?.isPrivate && !!segment?.filters?.length && (
                          <Button
                            variant="minimal"
                            size="sm"
                            className="flex items-center gap-2"
                            onClick={() => {
                              setIsSegmentEditorOpen(false);
                              setSegmentEditorViewOnly(false);

                              if (initialSegment) {
                                setSegment(initialSegment);
                              }
                            }}>
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-lg">
                      <div className="mb-2 flex items-center gap-6">
                        <UserGroupIcon className="h-6 w-6 text-slate-700" />
                        <div className="flex flex-col">
                          <h3 className="font-medium text-slate-900">{localSurvey.segment?.title}</h3>
                          <p className="text-sm text-slate-500">{localSurvey.segment?.description}</p>
                        </div>
                      </div>

                      {segmentEditorViewOnly && segment && (
                        <div className="opacity-60">
                          <BasicSegmentEditor
                            key={segment.filters.toString()}
                            group={segment.filters}
                            environmentId={environmentId}
                            segment={segment}
                            attributeClasses={attributeClasses}
                            setSegment={setSegment}
                            viewOnly
                          />
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setSegmentEditorViewOnly(!segmentEditorViewOnly);
                          }}>
                          {segmentEditorViewOnly ? "Hide" : "View"} Filters{" "}
                          {segmentEditorViewOnly ? (
                            <ChevronDownIcon className="ml-2 h-3 w-3" />
                          ) : (
                            <ChevronUpIcon className="ml-2 h-3 w-3" />
                          )}
                        </Button>

                        {isSegmentUsedInOtherSurveys && (
                          <Button variant="secondary" size="sm" onClick={() => handleCloneSegment()}>
                            Clone & Edit Segment
                          </Button>
                        )}
                        <Button
                          variant={isSegmentUsedInOtherSurveys ? "minimal" : "secondary"}
                          size="sm"
                          onClick={() => {
                            if (isSegmentUsedInOtherSurveys) {
                              setSegmentUsedModalOpen(true);
                            } else {
                              setIsSegmentEditorOpen(true);
                              setSegmentEditorViewOnly(false);
                            }
                          }}>
                          {isSegmentUsedInOtherSurveys ? "Go to Segment View" : "Edit Segment"}
                          <PencilIcon className="ml-2 h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="ml-6 mt-4 flex w-full gap-4">
          <Button variant="secondary" size="sm" onClick={() => setLoadSegmentModalOpen(true)}>
            Load Segment <HardDriveUploadIcon className="ml-2 h-4 w-4" />
          </Button>

          {isSegmentEditorOpen && !!segment?.filters?.length && (
            <Button
              variant="minimal"
              size="sm"
              className="flex items-center gap-2"
              onClick={() => setSaveAsNewSegmentModalOpen(true)}>
              Save as new Segment <HardDriveDownloadIcon className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="px-6 pb-6 pt-3">
          <UpgradePlanNotice
            message="For advanced user targeting,"
            url={`/environments/${environmentId}/settings/billing`}
            textForUrl="please use Pro (free to get started)."
          />
        </div>

        {!!segment && (
          <LoadSegmentModal
            open={loadSegmentModalOpen}
            setOpen={setLoadSegmentModalOpen}
            surveyId={localSurvey.id}
            step={loadSegmentModalStep}
            setStep={setLoadSegmentModalStep}
            currentSegment={segment}
            segments={segments.filter((segment) => !isAdvancedSegment(segment.filters))}
            setSegment={setSegment}
            setIsSegmentEditorOpen={setIsSegmentEditorOpen}
            onSegmentLoad={handleLoadNewSegment}
          />
        )}

        <BasicAddFilterModal
          onAddFilter={(filter) => {
            handleAddFilterInGroup(filter);
          }}
          open={addFilterModalOpen}
          setOpen={setAddFilterModalOpen}
          attributeClasses={attributeClasses}
        />

        {!!segment && (
          <SaveAsNewSegmentModal
            open={saveAsNewSegmentModalOpen}
            setOpen={setSaveAsNewSegmentModalOpen}
            localSurvey={localSurvey}
            segment={segment}
            setSegment={setSegment}
            setIsSegmentEditorOpen={setIsSegmentEditorOpen}
            onCreateSegment={async (data) => createBasicSegmentAction(data)}
            onUpdateSegment={async (environmentId, segmentId, data) =>
              updateBasicSegmentAction(environmentId, segmentId, data)
            }
          />
        )}

        <SegmentAlreadyUsedModal
          open={segmentUsedModalOpen}
          setOpen={setSegmentUsedModalOpen}
          environmentId={environmentId}
        />

        <AlertDialog
          headerText="Are you sure?"
          open={resetAllFiltersModalOpen}
          setOpen={setResetAllFiltersModalOpen}
          mainText="This action resets all filters in this survey."
          declineBtnLabel="Cancel"
          onDecline={() => {
            setResetAllFiltersModalOpen(false);
          }}
          confirmBtnLabel="Remove all filters"
          onConfirm={() => {
            const updatedSegment = structuredClone(segment);
            if (updatedSegment?.filters) {
              updatedSegment.filters = [];
            }

            setSegment(updatedSegment);
            setResetAllFiltersModalOpen(false);
          }}
        />
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}

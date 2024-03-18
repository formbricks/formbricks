"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { AlertCircle, CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { cn } from "@formbricks/lib/cn";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TBaseFilter, TSegment, TSegmentCreateInput, TSegmentUpdateInput } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys";
import AlertDialog from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import LoadSegmentModal from "@formbricks/ui/Targeting/LoadSegmentModal";
import SaveAsNewSegmentModal from "@formbricks/ui/Targeting/SaveAsNewSegmentModal";
import SegmentTitle from "@formbricks/ui/Targeting/SegmentTitle";
import TargetingIndicator from "@formbricks/ui/Targeting/TargetingIndicator";

import {
  cloneSegmentAction,
  createSegmentAction,
  loadNewSegmentAction,
  resetSegmentFiltersAction,
  updateSegmentAction,
} from "../lib/actions";
import { ACTIONS_TO_EXCLUDE } from "../lib/constants";
import AddFilterModal from "./AddFilterModal";
import SegmentEditor from "./SegmentEditor";

interface UserTargetingAdvancedCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  environmentId: string;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  segments: TSegment[];
  initialSegment?: TSegment;
}

export function AdvancedTargetingCard({
  localSurvey,
  setLocalSurvey,
  environmentId,
  actionClasses: actionClassesProps,
  attributeClasses,
  segments,
  initialSegment,
}: UserTargetingAdvancedCardProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<TSegment | null>(localSurvey.segment);

  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [saveAsNewSegmentModalOpen, setSaveAsNewSegmentModalOpen] = useState(false);
  const [resetAllFiltersModalOpen, setResetAllFiltersModalOpen] = useState(false);
  const [loadSegmentModalOpen, setLoadSegmentModalOpen] = useState(false);
  const [isSegmentEditorOpen, setIsSegmentEditorOpen] = useState(!!localSurvey.segment?.isPrivate);
  const [segmentEditorViewOnly, setSegmentEditorViewOnly] = useState(true);

  const actionClasses = actionClassesProps.filter((actionClass) => {
    if (actionClass.type === "automatic") {
      if (ACTIONS_TO_EXCLUDE.includes(actionClass.name)) {
        return false;
      }

      return true;
    }

    return true;
  });

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

  const handleCloneSegment = async () => {
    if (!segment) return;

    try {
      const clonedSegment = await cloneSegmentAction(segment.id, localSurvey.id);
      setSegment(clonedSegment);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (!!segment && segment?.filters?.length > 0) {
      setOpen(true);
    }
  }, [segment, segment?.filters?.length]);

  useEffect(() => {
    if (localSurvey.type === "link") {
      setOpen(false);
    }
  }, [localSurvey.type]);

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

  const handleLoadNewSegment = async (surveyId: string, segmentId: string) => {
    const updatedSurvey = await loadNewSegmentAction(surveyId, segmentId);
    return updatedSurvey;
  };

  const handleSaveAsNewSegmentUpdate = async (
    environmentId: string,
    segmentId: string,
    data: TSegmentUpdateInput
  ) => {
    const updatedSegment = await updateSegmentAction(environmentId, segmentId, data);
    return updatedSegment;
  };

  const handleSaveAsNewSegmentCreate = async (data: TSegmentCreateInput) => {
    const createdSegment = await createSegmentAction(data);
    return createdSegment;
  };

  const handleSaveSegment = async (data: TSegmentUpdateInput) => {
    try {
      if (!segment) throw new Error("Invalid segment");
      await updateSegmentAction(environmentId, segment?.id, data);
      toast.success("Segment saved successfully");

      setIsSegmentEditorOpen(false);
      setSegmentEditorViewOnly(true);
    } catch (err: any) {
      toast.error(err.message ?? "Error Saving Segment");
    }
  };

  const handleResetAllFilters = async () => {
    try {
      return await resetSegmentFiltersAction(localSurvey.id);
    } catch (err) {
      toast.error("Error resetting filters");
    }
  };

  if (localSurvey.type === "link") {
    return null; // Hide card completely
  }

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border bg-green-400 p-1.5 text-white"
            />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Target Audience</p>
            <p className="mt-1 text-sm text-slate-500">Pre-segment your users with attributes filters.</p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="min-w-full overflow-auto">
        <hr className="text-slate-600" />

        <div className="flex flex-col gap-5 p-6">
          <TargetingIndicator segment={segment} />

          <div className="filter-scrollbar flex flex-col gap-4 overflow-auto rounded-lg border border-slate-300 bg-slate-50 p-4">
            {!!segment && (
              <LoadSegmentModal
                open={loadSegmentModalOpen}
                setOpen={setLoadSegmentModalOpen}
                surveyId={localSurvey.id}
                currentSegment={segment}
                segments={segments}
                setSegment={setSegment}
                setIsSegmentEditorOpen={setIsSegmentEditorOpen}
                onSegmentLoad={handleLoadNewSegment}
              />
            )}

            {isSegmentEditorOpen ? (
              <div className="flex w-full flex-col gap-2">
                <SegmentTitle
                  title={localSurvey.segment?.title}
                  description={localSurvey.segment?.description}
                  isPrivate={segment?.isPrivate}
                />
                {!!segment?.filters?.length && (
                  <div className="w-full">
                    <SegmentEditor
                      key={segment.filters.toString()}
                      group={segment.filters}
                      environmentId={environmentId}
                      segment={segment}
                      setSegment={setSegment}
                      actionClasses={actionClasses}
                      attributeClasses={attributeClasses}
                      segments={segments}
                    />
                  </div>
                )}

                <div
                  className={cn(
                    "mt-3 flex items-center gap-2",
                    segment?.isPrivate && !segment?.filters?.length && "mt-0"
                  )}>
                  <Button variant="secondary" size="sm" onClick={() => setAddFilterModalOpen(true)}>
                    Add filter
                  </Button>

                  {isSegmentEditorOpen && !segment?.isPrivate && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        handleSaveSegment({ filters: segment?.filters ?? [] });
                      }}>
                      Save changes
                    </Button>
                  )}

                  {isSegmentEditorOpen && !segment?.isPrivate && (
                    <Button
                      variant="minimal"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => {
                        setIsSegmentEditorOpen(false);
                        setSegmentEditorViewOnly(true);

                        if (initialSegment) {
                          setSegment(initialSegment);
                        }
                      }}>
                      Cancel
                    </Button>
                  )}
                </div>

                <>
                  <AddFilterModal
                    onAddFilter={(filter) => {
                      handleAddFilterInGroup(filter);
                    }}
                    open={addFilterModalOpen}
                    setOpen={setAddFilterModalOpen}
                    actionClasses={actionClasses}
                    attributeClasses={attributeClasses}
                    segments={segments}
                  />
                  {!!segment && (
                    <SaveAsNewSegmentModal
                      open={saveAsNewSegmentModalOpen}
                      setOpen={setSaveAsNewSegmentModalOpen}
                      localSurvey={localSurvey}
                      segment={segment}
                      setSegment={setSegment}
                      setIsSegmentEditorOpen={setIsSegmentEditorOpen}
                      onCreateSegment={handleSaveAsNewSegmentCreate}
                      onUpdateSegment={handleSaveAsNewSegmentUpdate}
                    />
                  )}
                </>
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg">
                <SegmentTitle
                  title={localSurvey.segment?.title}
                  description={localSurvey.segment?.description}
                  isPrivate={segment?.isPrivate}
                />

                {segmentEditorViewOnly && segment && (
                  <div className="opacity-60">
                    <SegmentEditor
                      key={segment.filters.toString()}
                      group={segment.filters}
                      environmentId={environmentId}
                      segment={segment}
                      actionClasses={actionClasses}
                      attributeClasses={attributeClasses}
                      segments={segments}
                      setSegment={setSegment}
                      viewOnly={segmentEditorViewOnly}
                    />
                  </div>
                )}

                <div className="mt-3 flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setSegmentEditorViewOnly(!segmentEditorViewOnly);
                    }}>
                    {segmentEditorViewOnly ? "Hide" : "View"} Filters{" "}
                    {segmentEditorViewOnly ? (
                      <ChevronUpIcon className="ml-2 h-3 w-3" />
                    ) : (
                      <ChevronDownIcon className="ml-2 h-3 w-3" />
                    )}
                  </Button>

                  {isSegmentUsedInOtherSurveys && (
                    <Button variant="secondary" size="sm" onClick={() => handleCloneSegment()}>
                      Clone & Edit Segment
                    </Button>
                  )}
                  {!isSegmentUsedInOtherSurveys && (
                    <Button
                      variant={isSegmentUsedInOtherSurveys ? "minimal" : "secondary"}
                      size="sm"
                      onClick={() => {
                        setIsSegmentEditorOpen(true);
                        setSegmentEditorViewOnly(false);
                      }}>
                      Edit Segment
                      <PencilIcon className="ml-2 h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isSegmentUsedInOtherSurveys && (
                  <p className="mt-1 flex items-center text-xs text-slate-500">
                    <AlertCircle className="mr-1 inline h-3 w-3" />
                    This segment is used in other surveys. Make changes{" "}
                    <Link
                      href={`/environments/${environmentId}/segments`}
                      target="_blank"
                      className="ml-1 underline">
                      here.
                    </Link>
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button variant="secondary" size="sm" onClick={() => setLoadSegmentModalOpen(true)}>
              Load Segment
            </Button>

            {!segment?.isPrivate && !!segment?.filters?.length && (
              <Button variant="secondary" size="sm" onClick={() => setResetAllFiltersModalOpen(true)}>
                Reset all filters
              </Button>
            )}

            {isSegmentEditorOpen && !!segment?.filters?.length && (
              <Button
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setSaveAsNewSegmentModalOpen(true)}>
                Save as new Segment
              </Button>
            )}

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
              onConfirm={async () => {
                const segment = await handleResetAllFilters();
                if (segment) {
                  toast.success("Filters reset successfully");

                  setSegment(segment);
                  setResetAllFiltersModalOpen(false);

                  router.refresh();
                }
              }}
            />
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}

"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { AlertCircle, CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { cn } from "@formbricks/lib/cn";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import type { TActionClass } from "@formbricks/types/action-classes";
import type { TAttributeClass } from "@formbricks/types/attribute-classes";
import type {
  TBaseFilter,
  TSegment,
  TSegmentCreateInput,
  TSegmentUpdateInput,
} from "@formbricks/types/segment";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { AlertDialog } from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";
import { LoadSegmentModal } from "@formbricks/ui/LoadSegmentModal";
import { SaveAsNewSegmentModal } from "@formbricks/ui/SaveAsNewSegmentModal";
import { SegmentTitle } from "@formbricks/ui/SegmentTitle";
import { TargetingIndicator } from "@formbricks/ui/TargetingIndicator";
import {
  cloneSegmentAction,
  createSegmentAction,
  loadNewSegmentAction,
  resetSegmentFiltersAction,
  updateSegmentAction,
} from "../lib/actions";
import { AddFilterModal } from "./add-filter-modal";
import { SegmentEditor } from "./segment-editor";

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
  actionClasses,
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
  const [isSegmentEditorOpen, setIsSegmentEditorOpen] = useState(Boolean(localSurvey.segment?.isPrivate));
  const [segmentEditorViewOnly, setSegmentEditorViewOnly] = useState(true);

  useEffect(() => {
    setLocalSurvey((localSurveyOld) => ({
      ...localSurveyOld,
      segment,
    }));
  }, [setLocalSurvey, segment]);

  const isSegmentUsedInOtherSurveys = useMemo(
    () => (localSurvey.segment ? localSurvey.segment.surveys.length > 1 : false),
    [localSurvey.segment]
  );

  const handleCloneSegment = async () => {
    if (!segment) return;

    try {
      const clonedSegmentResponse = await cloneSegmentAction({
        segmentId: segment.id,
        surveyId: localSurvey.id,
      });
      if (clonedSegmentResponse?.data) {
        setSegment(clonedSegmentResponse.data);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (segment && segment.filters.length > 0) {
      setOpen(true);
    }
  }, [segment, segment?.filters.length]);

  useEffect(() => {
    if (localSurvey.type === "link") {
      setOpen(false);
    }
  }, [localSurvey.type]);

  const handleAddFilterInGroup = (filter: TBaseFilter) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment?.filters.length === 0) {
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
    const updatedSurvey = await loadNewSegmentAction({ surveyId: surveyId, segmentId });
    return updatedSurvey?.data as TSurvey;
  };

  const handleSaveAsNewSegmentUpdate = async (segmentId: string, data: TSegmentUpdateInput) => {
    const updatedSegment = await updateSegmentAction({ segmentId, data });
    return updatedSegment?.data as TSegment;
  };

  const handleSaveAsNewSegmentCreate = async (data: TSegmentCreateInput) => {
    const createdSegment = await createSegmentAction(data);
    return createdSegment?.data as TSegment;
  };

  const handleSaveSegment = async (data: TSegmentUpdateInput) => {
    try {
      if (!segment) throw new Error("Invalid segment");
      await updateSegmentAction({ segmentId: segment.id, data });
      toast.success("Segment saved successfully");

      setIsSegmentEditorOpen(false);
      setSegmentEditorViewOnly(true);
    } catch (err: any) {
      toast.error(err.message ?? "Error Saving Segment");
    }
  };

  const handleResetAllFilters = async () => {
    try {
      const segmentResponse = await resetSegmentFiltersAction({ surveyId: localSurvey.id });
      return segmentResponse?.data;
    } catch (err) {
      toast.error("Error resetting filters");
    }
  };

  if (localSurvey.type === "link") {
    return null; // Hide card completely
  }

  if (!segment) {
    throw new Error("Survey segment is missing");
  }

  return (
    <Collapsible.Root
      className="w-full rounded-lg border border-slate-300 bg-white"
      onOpenChange={setOpen}
      open={open}>
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              strokeWidth={3}
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
            {Boolean(segment) && (
              <LoadSegmentModal
                currentSegment={segment}
                onSegmentLoad={handleLoadNewSegment}
                open={loadSegmentModalOpen}
                segments={segments}
                setIsSegmentEditorOpen={setIsSegmentEditorOpen}
                setOpen={setLoadSegmentModalOpen}
                setSegment={setSegment}
                surveyId={localSurvey.id}
              />
            )}

            {isSegmentEditorOpen ? (
              <div className="flex w-full flex-col gap-2">
                <SegmentTitle
                  description={localSurvey.segment?.description}
                  isPrivate={segment?.isPrivate}
                  title={localSurvey.segment?.title}
                />
                {Boolean(segment?.filters.length) && (
                  <div className="w-full">
                    <SegmentEditor
                      actionClasses={actionClasses}
                      attributeClasses={attributeClasses}
                      environmentId={environmentId}
                      group={segment.filters}
                      key={segment.filters.toString()}
                      segment={segment}
                      segments={segments}
                      setSegment={setSegment}
                    />
                  </div>
                )}

                <div
                  className={cn(
                    "mt-3 flex items-center gap-2",
                    segment?.isPrivate && !segment.filters.length && "mt-0"
                  )}>
                  <Button
                    onClick={() => {
                      setAddFilterModalOpen(true);
                    }}
                    size="sm"
                    variant="secondary">
                    Add filter
                  </Button>

                  {isSegmentEditorOpen && !segment?.isPrivate ? (
                    <Button
                      onClick={() => {
                        handleSaveSegment({ filters: segment?.filters ?? [] });
                      }}
                      size="sm"
                      variant="secondary">
                      Save changes
                    </Button>
                  ) : null}

                  {isSegmentEditorOpen && !segment?.isPrivate ? (
                    <Button
                      className="flex items-center gap-2"
                      onClick={() => {
                        setIsSegmentEditorOpen(false);
                        setSegmentEditorViewOnly(true);

                        if (initialSegment) {
                          setSegment(initialSegment);
                        }
                      }}
                      size="sm"
                      variant="minimal">
                      Cancel
                    </Button>
                  ) : null}
                </div>

                <AddFilterModal
                  actionClasses={actionClasses}
                  attributeClasses={attributeClasses}
                  onAddFilter={(filter) => {
                    handleAddFilterInGroup(filter);
                  }}
                  open={addFilterModalOpen}
                  segments={segments}
                  setOpen={setAddFilterModalOpen}
                />
                {Boolean(segment) && (
                  <SaveAsNewSegmentModal
                    localSurvey={localSurvey}
                    onCreateSegment={handleSaveAsNewSegmentCreate}
                    onUpdateSegment={handleSaveAsNewSegmentUpdate}
                    open={saveAsNewSegmentModalOpen}
                    segment={segment}
                    setIsSegmentEditorOpen={setIsSegmentEditorOpen}
                    setOpen={setSaveAsNewSegmentModalOpen}
                    setSegment={setSegment}
                  />
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2 rounded-lg">
                <SegmentTitle
                  description={localSurvey.segment?.description}
                  isPrivate={segment?.isPrivate}
                  title={localSurvey.segment?.title}
                />

                {segmentEditorViewOnly && segment ? (
                  <div className="opacity-60">
                    <SegmentEditor
                      actionClasses={actionClasses}
                      attributeClasses={attributeClasses}
                      environmentId={environmentId}
                      group={segment.filters}
                      key={segment.filters.toString()}
                      segment={segment}
                      segments={segments}
                      setSegment={setSegment}
                      viewOnly={segmentEditorViewOnly}
                    />
                  </div>
                ) : null}

                <div className="mt-3 flex items-center gap-3">
                  <Button
                    onClick={() => {
                      setSegmentEditorViewOnly(!segmentEditorViewOnly);
                    }}
                    size="sm"
                    variant="secondary">
                    {segmentEditorViewOnly ? "Hide" : "View"} Filters{" "}
                    {segmentEditorViewOnly ? (
                      <ChevronUpIcon className="ml-2 h-3 w-3" />
                    ) : (
                      <ChevronDownIcon className="ml-2 h-3 w-3" />
                    )}
                  </Button>

                  {isSegmentUsedInOtherSurveys ? (
                    <Button onClick={() => handleCloneSegment()} size="sm" variant="secondary">
                      Clone & Edit Segment
                    </Button>
                  ) : null}
                  {!isSegmentUsedInOtherSurveys && (
                    <Button
                      onClick={() => {
                        setIsSegmentEditorOpen(true);
                        setSegmentEditorViewOnly(false);
                      }}
                      size="sm"
                      variant={isSegmentUsedInOtherSurveys ? "minimal" : "secondary"}>
                      Edit Segment
                      <PencilIcon className="ml-2 h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isSegmentUsedInOtherSurveys ? (
                  <p className="mt-1 flex items-center text-xs text-slate-500">
                    <AlertCircle className="mr-1 inline h-3 w-3" />
                    This segment is used in other surveys. Make changes{" "}
                    <Link
                      className="ml-1 underline"
                      href={`/environments/${environmentId}/segments`}
                      target="_blank">
                      here.
                    </Link>
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => {
                setLoadSegmentModalOpen(true);
              }}
              size="sm"
              variant="secondary">
              Load Segment
            </Button>

            {!segment?.isPrivate && Boolean(segment?.filters.length) && (
              <Button
                onClick={() => {
                  setResetAllFiltersModalOpen(true);
                }}
                size="sm"
                variant="secondary">
                Reset all filters
              </Button>
            )}

            {isSegmentEditorOpen && Boolean(segment?.filters.length) ? (
              <Button
                className="flex items-center gap-2"
                onClick={() => {
                  setSaveAsNewSegmentModalOpen(true);
                }}
                size="sm"
                variant="secondary">
                Save as new Segment
              </Button>
            ) : null}

            <AlertDialog
              confirmBtnLabel="Remove all filters"
              declineBtnLabel="Cancel"
              headerText="Are you sure?"
              mainText="This action resets all filters in this survey."
              onConfirm={async () => {
                const segment = await handleResetAllFilters();
                if (segment) {
                  toast.success("Filters reset successfully");

                  setSegment(segment);
                  setResetAllFiltersModalOpen(false);

                  router.refresh();
                }
              }}
              onDecline={() => {
                setResetAllFiltersModalOpen(false);
              }}
              open={resetAllFiltersModalOpen}
              setOpen={setResetAllFiltersModalOpen}
            />
          </div>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}

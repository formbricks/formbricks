"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { AlertCircle, CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { cn } from "@formbricks/lib/cn";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { isAdvancedSegment } from "@formbricks/lib/segment/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TBaseFilter, TSegment, TSegmentCreateInput, TSegmentUpdateInput } from "@formbricks/types/segment";
import { TSurvey } from "@formbricks/types/surveys/types";
import { AlertDialog } from "@formbricks/ui/AlertDialog";
import { BasicAddFilterModal } from "@formbricks/ui/BasicAddFilterModal";
import { BasicSegmentEditor } from "@formbricks/ui/BasicSegmentEditor";
import { Button } from "@formbricks/ui/Button";
import { LoadSegmentModal } from "@formbricks/ui/LoadSegmentModal";
import { SaveAsNewSegmentModal } from "@formbricks/ui/SaveAsNewSegmentModal";
import { SegmentTitle } from "@formbricks/ui/SegmentTitle";
import { TargetingIndicator } from "@formbricks/ui/TargetingIndicator";
import { UpgradePlanNotice } from "@formbricks/ui/UpgradePlanNotice";
import {
  cloneBasicSegmentAction,
  createBasicSegmentAction,
  loadNewBasicSegmentAction,
  resetBasicSegmentFiltersAction,
  updateBasicSegmentAction,
} from "../actions";

interface TargetingCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  environmentId: string;
  attributeClasses: TAttributeClass[];
  segments: TSegment[];
  initialSegment?: TSegment;
  isFormbricksCloud: boolean;
}

export const TargetingCard = ({
  localSurvey,
  setLocalSurvey,
  environmentId,
  attributeClasses,
  segments,
  initialSegment,
  isFormbricksCloud,
}: TargetingCardProps) => {
  const router = useRouter();
  const [segment, setSegment] = useState<TSegment | null>(localSurvey.segment);
  const [open, setOpen] = useState(false);
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [saveAsNewSegmentModalOpen, setSaveAsNewSegmentModalOpen] = useState(false);
  const [isSegmentEditorOpen, setIsSegmentEditorOpen] = useState(!!localSurvey.segment?.isPrivate);
  const [loadSegmentModalOpen, setLoadSegmentModalOpen] = useState(false);
  const [resetAllFiltersModalOpen, setResetAllFiltersModalOpen] = useState(false);
  const [segmentEditorViewOnly, setSegmentEditorViewOnly] = useState(true);

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

  const handleEditSegment = () => {
    setIsSegmentEditorOpen(true);
    setSegmentEditorViewOnly(false);
  };

  const handleCloneSegment = async () => {
    if (!segment) return;

    const cloneBasicSegmentResponse = await cloneBasicSegmentAction({
      segmentId: segment.id,
      surveyId: localSurvey.id,
    });

    if (cloneBasicSegmentResponse?.data) {
      setSegment(cloneBasicSegmentResponse.data);
    } else {
      const errorMessage = getFormattedErrorMessage(cloneBasicSegmentResponse);
      toast.error(errorMessage);
    }
  };

  const handleLoadNewSegment = async (surveyId: string, segmentId: string) => {
    const loadNewBasicSegmentResponse = await loadNewBasicSegmentAction({ surveyId, segmentId });
    return loadNewBasicSegmentResponse?.data as TSurvey;
  };

  const handleSegmentUpdate = async (segmentId: string, data: TSegmentUpdateInput) => {
    const updateBasicSegmentResponse = await updateBasicSegmentAction({ segmentId, data });
    return updateBasicSegmentResponse?.data as TSegment;
  };

  const handleSegmentCreate = async (data: TSegmentCreateInput) => {
    const createdSegment = await createBasicSegmentAction(data);
    return createdSegment?.data as TSegment;
  };

  const handleSaveSegment = async (data: TSegmentUpdateInput) => {
    try {
      if (!segment) throw new Error("Invalid segment");
      await updateBasicSegmentAction({ segmentId: segment?.id, data });

      router.refresh();
      toast.success("Segment saved successfully");

      setIsSegmentEditorOpen(false);
      setSegmentEditorViewOnly(true);
    } catch (err) {
      toast.error(err.message ?? "Error Saving Segment");
    }
  };

  const handleResetAllFilters = async () => {
    try {
      const resetBasicSegmentFiltersResponse = await resetBasicSegmentFiltersAction({
        surveyId: localSurvey.id,
      });
      return resetBasicSegmentFiltersResponse?.data;
    } catch (err) {
      toast.error("Error resetting filters");
    }
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
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <div className="inline-flex px-4 py-6">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              strokeWidth={3}
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
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
            <div className="flex w-full flex-col gap-2">
              {isAdvancedSegment(segment?.filters ?? []) ? (
                <div>
                  <SegmentTitle
                    title={localSurvey.segment?.title}
                    description={localSurvey.segment?.description}
                    isPrivate={localSurvey.segment?.isPrivate}
                  />

                  <p className="text-sm italic text-slate-600">
                    This is an advanced segment. Please upgrade your plan to edit it.
                  </p>
                </div>
              ) : (
                <>
                  {isSegmentEditorOpen ? (
                    <div className="flex w-full flex-col gap-2">
                      <div>
                        {!segment?.isPrivate ? (
                          <SegmentTitle
                            title={localSurvey.segment?.title}
                            description={localSurvey.segment?.description}
                          />
                        ) : (
                          <div className="mb-4">
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
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 rounded-lg">
                      <SegmentTitle
                        title={localSurvey.segment?.title}
                        description={localSurvey.segment?.description}
                        isPrivate={localSurvey.segment?.isPrivate}
                      />

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
                            <ChevronUpIcon className="ml-2 h-3 w-3" />
                          ) : (
                            <ChevronDownIcon className="ml-2 h-3 w-3" />
                          )}
                        </Button>

                        {isSegmentUsedInOtherSurveys && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              handleCloneSegment();
                            }}>
                            Clone & Edit Segment
                          </Button>
                        )}

                        {!isSegmentUsedInOtherSurveys && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              handleEditSegment();
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
                </>
              )}
            </div>
          </div>

          <div className="flex w-full gap-3">
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
          </div>
          <div className="-mt-1.5">
            {isFormbricksCloud ? (
              <UpgradePlanNotice
                message="For advanced targeting, please"
                textForUrl="upgrade to the User Identification plan."
                url={`/environments/${environmentId}/settings/billing`}
              />
            ) : (
              <UpgradePlanNotice
                message="For advanced targeting, please"
                textForUrl="request an Enterprise license."
                url={`/environments/${environmentId}/settings/enterprise`}
              />
            )}
          </div>
        </div>

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
            onCreateSegment={handleSegmentCreate}
            onUpdateSegment={handleSegmentUpdate}
          />
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
              router.refresh();
              setSegment(segment);
              setResetAllFiltersModalOpen(false);
            }
          }}
        />
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

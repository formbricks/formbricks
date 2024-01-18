"use client";

import { CheckCircleIcon, ExclamationCircleIcon, UserGroupIcon } from "@heroicons/react/24/solid";
import * as Collapsible from "@radix-ui/react-collapsible";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import AddFilterModal from "@formbricks/ee/advancedUserTargeting/components/AddFilterModal";
import LoadSegmentModal from "@formbricks/ee/advancedUserTargeting/components/LoadSegmentModal";
import SaveAsNewSegmentModal from "@formbricks/ee/advancedUserTargeting/components/SaveAsNewSegmentModal";
import SegmentAlreadyUsedModal from "@formbricks/ee/advancedUserTargeting/components/SegmentAlreadyUsedModal";
import SegmentFilters from "@formbricks/ee/advancedUserTargeting/components/SegmentFilters";
import { cloneUserSegmentAction } from "@formbricks/ee/advancedUserTargeting/lib/actions";
import { TActionClass } from "@formbricks/types/actionClasses";
import { TAttributeClass } from "@formbricks/types/attributeClasses";
import { TSurvey } from "@formbricks/types/surveys";
import { TBaseFilterGroupItem, TUserSegment } from "@formbricks/types/userSegment";
import AlertDialog from "@formbricks/ui/AlertDialog";
import { Button } from "@formbricks/ui/Button";

interface WhoToSendCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  environmentId: string;
  actionClasses: TActionClass[];
  attributeClasses: TAttributeClass[];
  userSegments: TUserSegment[];
}

export default function WhoToSendCard({
  localSurvey,
  setLocalSurvey,
  environmentId,
  actionClasses,
  attributeClasses,
  userSegments,
}: WhoToSendCardProps) {
  const [open, setOpen] = useState(false);
  const [userSegment, setUserSegment] = useState<TUserSegment | null>(localSurvey.userSegment ?? null);

  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [saveAsNewSegmentModalOpen, setSaveAsNewSegmentModalOpen] = useState(false);
  const [resetAllFiltersModalOpen, setResetAllFiltersModalOpen] = useState(false);
  const [loadSegmentModalOpen, setLoadSegmentModalOpen] = useState(false);
  const [loadSegmentModalStep, setLoadSegmentModalStep] = useState<"initial" | "load">("initial");
  const [isSegmentEditorOpen, setIsSegmentEditorOpen] = useState(localSurvey.userSegment?.isPrivate);
  const [segmentUsedModalOpen, setSegmentUsedModalOpen] = useState(false);
  const [segmentEditorViewOnly, setSegmentEditorViewOnly] = useState(false);

  useEffect(() => {
    setLocalSurvey((localSurveyOld) => ({
      ...localSurveyOld,
      userSegmentId: userSegment?.id ?? null,
      userSegment,
    }));
  }, [setLocalSurvey, userSegment]);

  const isSegmentUsedInOtherSurveys = useMemo(
    () => (localSurvey?.userSegment ? localSurvey.userSegment?.surveys?.length > 1 : false),
    [localSurvey.userSegment]
  );

  const handleCloneSegment = async () => {
    if (!userSegment) return;

    try {
      const clonedUserSegment = await cloneUserSegmentAction(userSegment.id, localSurvey.id);

      setUserSegment(clonedUserSegment);
    } catch (err) {
      toast.error(err.message);
    }
  };

  useEffect(() => {
    if (!!userSegment && userSegment?.filters?.length > 0) {
      setOpen(true);
    }
  }, [userSegment, userSegment?.filters?.length]);

  useEffect(() => {
    if (localSurvey.type === "link") {
      setOpen(false);
    }
  }, [localSurvey.type]);

  const handleAddFilterInGroup = (filter: TBaseFilterGroupItem) => {
    const updatedUserSegment = structuredClone(userSegment);
    if (updatedUserSegment?.filters?.length === 0) {
      updatedUserSegment.filters.push({
        ...filter,
        connector: null,
      });
    } else {
      updatedUserSegment?.filters.push(filter);
    }

    setUserSegment(updatedUserSegment);
  };

  if (localSurvey.type === "link") {
    return null; // Hide card completely
  }

  return (
    <>
      <Collapsible.Root
        open={open}
        onOpenChange={setOpen}
        className="w-full rounded-lg border border-slate-300 bg-white">
        <Collapsible.CollapsibleTrigger
          asChild
          className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
          <div className="inline-flex px-4 py-6">
            <div className="flex items-center pl-2 pr-5">
              <CheckCircleIcon className="h-8 w-8 text-green-400 " />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Target Audience</p>
              <p className="mt-1 text-sm text-slate-500">Pre-segment your users with attributes filters.</p>
            </div>
          </div>
        </Collapsible.CollapsibleTrigger>
        <Collapsible.CollapsibleContent className="min-w-full overflow-auto">
          <hr className="py-1 text-slate-600" />

          <div className="flex flex-col gap-2 p-6">
            {!userSegment?.filters?.length && (
              <div className="mb-4 flex w-full items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 px-6 py-4 text-amber-800">
                <ExclamationCircleIcon className="h-6 w-6 text-amber-500" />
                <div className="flex flex-col">
                  <h3 className="text-base font-medium">Currently, all users are targeted.</h3>
                  <p className="text-sm">Without a filter, all of your users can be surveyed.</p>
                </div>
              </div>
            )}

            <div className="filter-scrollbar flex flex-col gap-4 overflow-auto rounded-lg border-2 border-slate-300 bg-white p-4">
              <SegmentAlreadyUsedModal
                open={segmentUsedModalOpen}
                setOpen={setSegmentUsedModalOpen}
                environmentId={environmentId}
              />

              {!!userSegment && (
                <LoadSegmentModal
                  open={loadSegmentModalOpen}
                  setOpen={setLoadSegmentModalOpen}
                  surveyId={localSurvey.id}
                  step={loadSegmentModalStep}
                  setStep={setLoadSegmentModalStep}
                  userSegment={userSegment}
                  userSegments={userSegments}
                  setUserSegment={setUserSegment}
                  setIsSegmentEditorOpen={setIsSegmentEditorOpen}
                />
              )}

              {segmentEditorViewOnly && userSegment && (
                <div className="pointer-events-none opacity-60">
                  <SegmentFilters
                    key={userSegment.filters.toString()}
                    group={userSegment.filters}
                    environmentId={environmentId}
                    userSegment={userSegment}
                    actionClasses={actionClasses}
                    attributeClasses={attributeClasses}
                    userSegments={userSegments}
                    setUserSegment={setUserSegment}
                  />
                </div>
              )}

              {isSegmentEditorOpen ? (
                <div className="w-full">
                  <div className="mb-4">
                    <p className="text-sm font-semibold">Send survey to audience who match...</p>
                    <p className="text-sm">Without a filter, all of your users can be surveyed.</p>
                  </div>
                  {!!userSegment?.filters?.length && (
                    <div className="w-full">
                      <SegmentFilters
                        key={userSegment.filters.toString()}
                        group={userSegment.filters}
                        environmentId={environmentId}
                        userSegment={userSegment}
                        setUserSegment={setUserSegment}
                        actionClasses={actionClasses}
                        attributeClasses={attributeClasses}
                        userSegments={userSegments}
                      />
                    </div>
                  )}

                  <div className="mt-4 flex items-center gap-4">
                    <Button variant="secondary" size="sm" onClick={() => setAddFilterModalOpen(true)}>
                      Add filter
                    </Button>

                    {isSegmentEditorOpen && !!userSegment?.filters?.length && (
                      <Button
                        variant="minimal"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => setResetAllFiltersModalOpen(true)}>
                        <p className="text-sm">Reset all filters</p>
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
                      userSegments={userSegments}
                    />
                    {!!userSegment && (
                      <SaveAsNewSegmentModal
                        open={saveAsNewSegmentModalOpen}
                        setOpen={setSaveAsNewSegmentModalOpen}
                        localSurvey={localSurvey}
                        userSegment={userSegment}
                        setUserSegment={setUserSegment}
                        setIsSegmentEditorOpen={setIsSegmentEditorOpen}
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
                      confirmBtnLabel="Ok"
                      onConfirm={() => {
                        const updatedUserSegment = structuredClone(userSegment);
                        if (updatedUserSegment?.filters) {
                          updatedUserSegment.filters = [];
                        }

                        setUserSegment(updatedUserSegment);
                        setResetAllFiltersModalOpen(false);
                      }}
                    />
                  </>
                </div>
              ) : (
                <div className="flex flex-col gap-4 rounded-lg p-2">
                  <div className="mb-2 flex items-center gap-6">
                    <UserGroupIcon className="h-6 w-6 text-slate-700" />
                    <div className="flex flex-col">
                      <h3 className="font-medium text-slate-900">{localSurvey.userSegment?.title}</h3>
                      <p className="text-sm text-slate-500">{localSurvey.userSegment?.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSegmentEditorViewOnly(!segmentEditorViewOnly);
                        }}>
                        {segmentEditorViewOnly ? "Hide" : "View"} Filters
                      </Button>
                    </div>

                    {isSegmentUsedInOtherSurveys && (
                      <Button
                        variant="secondary"
                        size="sm"
                        className="flex items-center gap-2"
                        onClick={() => handleCloneSegment()}>
                        <p className="text-sm">Clone segment</p>
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => {
                        if (isSegmentUsedInOtherSurveys) {
                          setSegmentUsedModalOpen(true);
                        } else {
                          setIsSegmentEditorOpen(true);
                          setSegmentEditorViewOnly(false);
                        }
                      }}>
                      <p className="text-sm">Edit Segment</p>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex w-full gap-4">
              <Button
                variant="secondary"
                size="sm"
                className="flex items-center gap-2 text-sm"
                onClick={() => setLoadSegmentModalOpen(true)}>
                Load Segment
              </Button>

              {isSegmentEditorOpen && !!userSegment?.filters?.length && (
                <Button
                  variant="minimal"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() => setSaveAsNewSegmentModalOpen(true)}>
                  <p className="text-sm">Save as new Segment</p>
                </Button>
              )}
            </div>
          </div>
        </Collapsible.CollapsibleContent>
      </Collapsible.Root>
    </>
  );
}

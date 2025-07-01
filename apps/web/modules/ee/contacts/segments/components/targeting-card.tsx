"use client";

import { cn } from "@/lib/cn";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import {
  cloneSegmentAction,
  createSegmentAction,
  loadNewSegmentAction,
  resetSegmentFiltersAction,
  updateSegmentAction,
} from "@/modules/ee/contacts/segments/actions";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { AlertDialog } from "@/modules/ui/components/alert-dialog";
import { Button } from "@/modules/ui/components/button";
import { LoadSegmentModal } from "@/modules/ui/components/load-segment-modal";
import { SaveAsNewSegmentModal } from "@/modules/ui/components/save-as-new-segment-modal";
import { SegmentTitle } from "@/modules/ui/components/segment-title";
import { TargetingIndicator } from "@/modules/ui/components/targeting-indicator";
import * as Collapsible from "@radix-ui/react-collapsible";
import { useTranslate } from "@tolgee/react";
import { AlertCircle, CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import type {
  TBaseFilter,
  TSegment,
  TSegmentCreateInput,
  TSegmentUpdateInput,
} from "@formbricks/types/segment";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { AddFilterModal } from "./add-filter-modal";
import { SegmentEditor } from "./segment-editor";

interface TargetingCardProps {
  localSurvey: TSurvey;
  setLocalSurvey: React.Dispatch<React.SetStateAction<TSurvey>>;
  environmentId: string;
  contactAttributeKeys: TContactAttributeKey[];
  segments: TSegment[];
  initialSegment?: TSegment;
}

export function TargetingCard({
  localSurvey,
  setLocalSurvey,
  environmentId,
  contactAttributeKeys,
  segments,
  initialSegment,
}: TargetingCardProps) {
  const { t } = useTranslate();
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
    const updatedSegment = await updateSegmentAction({ segmentId, environmentId, data });
    return updatedSegment?.data as TSegment;
  };

  const handleSaveAsNewSegmentCreate = async (data: TSegmentCreateInput) => {
    const createdSegment = await createSegmentAction(data);
    return createdSegment?.data as TSegment;
  };

  const handleSaveSegment = async (data: TSegmentUpdateInput) => {
    try {
      if (!segment) throw new Error(t("environments.segments.invalid_segment"));
      await updateSegmentAction({ segmentId: segment.id, environmentId, data });
      toast.success(t("environments.segments.segment_saved_successfully"));

      setIsSegmentEditorOpen(false);
      setSegmentEditorViewOnly(true);
    } catch (err: any) {
      toast.error(err.message ?? t("environments.segments.error_saving_segment"));
    }
  };

  const handleResetAllFilters = async () => {
    try {
      const segmentResponse = await resetSegmentFiltersAction({ surveyId: localSurvey.id });
      return segmentResponse?.data;
    } catch (err) {
      toast.error(t("environments.segments.error_resetting_filters"));
    }
  };

  if (localSurvey.type === "link") {
    return null; // Hide card completely
  }

  if (!segment) {
    throw new Error(t("environments.segments.invalid_segment"));
  }

  return (
    <Collapsible.Root
      className="w-full overflow-hidden rounded-lg border border-slate-300 bg-white"
      onOpenChange={setOpen}
      open={open}>
      <Collapsible.CollapsibleTrigger
        asChild
        className="h-full w-full cursor-pointer rounded-lg hover:bg-slate-50">
        <div className="inline-flex px-4 py-4">
          <div className="flex items-center pl-2 pr-5">
            <CheckIcon
              className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              strokeWidth={3}
            />
          </div>
          <div>
            <p className="font-semibold text-slate-800">{t("environments.segments.target_audience")}</p>
            <p className="mt-1 text-sm text-slate-500">{t("environments.segments.pre_segment_users")}</p>
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
                      contactAttributeKeys={contactAttributeKeys}
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
                    {t("common.add_filter")}
                  </Button>

                  {isSegmentEditorOpen && !segment?.isPrivate ? (
                    <Button
                      onClick={() => {
                        handleSaveSegment({ filters: segment?.filters ?? [] });
                      }}
                      size="sm"
                      variant="secondary">
                      {t("common.save_changes")}
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
                      variant="ghost">
                      {t("common.cancel")}
                    </Button>
                  ) : null}
                </div>

                <AddFilterModal
                  contactAttributeKeys={contactAttributeKeys}
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
                      contactAttributeKeys={contactAttributeKeys}
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
                    {segmentEditorViewOnly
                      ? t("environments.segments.hide_filters")
                      : t("environments.segments.view_filters")}
                    {segmentEditorViewOnly ? (
                      <ChevronUpIcon className="ml-2 h-3 w-3" />
                    ) : (
                      <ChevronDownIcon className="ml-2 h-3 w-3" />
                    )}
                  </Button>

                  {isSegmentUsedInOtherSurveys ? (
                    <Button onClick={() => handleCloneSegment()} size="sm" variant="secondary">
                      {t("environments.segments.clone_and_edit_segment")}
                    </Button>
                  ) : null}
                  {!isSegmentUsedInOtherSurveys && (
                    <Button
                      onClick={() => {
                        setIsSegmentEditorOpen(true);
                        setSegmentEditorViewOnly(false);
                      }}
                      size="sm"
                      variant={isSegmentUsedInOtherSurveys ? "ghost" : "secondary"}>
                      {t("environments.segments.edit_segment")}
                      <PencilIcon className="ml-2 h-3 w-3" />
                    </Button>
                  )}
                </div>
                {isSegmentUsedInOtherSurveys ? (
                  <p className="mt-1 flex items-center text-xs text-slate-500">
                    <AlertCircle className="mr-1 inline h-3 w-3" />
                    {t("environments.segments.this_segment_is_used_in_other_surveys")}
                    <Link
                      className="ml-1 underline"
                      href={`/environments/${environmentId}/segments`}
                      target="_blank">
                      {t("environments.segments.here")}
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
              {t("environments.segments.load_segment")}
            </Button>

            {!segment?.isPrivate && Boolean(segment?.filters.length) && (
              <Button
                onClick={() => {
                  setResetAllFiltersModalOpen(true);
                }}
                size="sm"
                variant="secondary">
                {t("environments.segments.reset_all_filters")}
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
                {t("environments.segments.save_as_new_segment")}
              </Button>
            ) : null}

            <AlertDialog
              confirmBtnLabel={t("environments.segments.remove_all_filters")}
              declineBtnLabel={t("common.cancel")}
              headerText={t("common.are_you_sure")}
              mainText={t("environments.segments.this_action_resets_all_filters_in_this_survey")}
              onConfirm={async () => {
                const segment = await handleResetAllFilters();
                if (segment) {
                  toast.success(t("environments.segments.filters_reset_successfully"));

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

        <div>
          <Alert className="flex items-center rounded-none bg-slate-50">
            <AlertDescription className="ml-2">
              <span className="mr-1 text-slate-600">
                {t("environments.segments.user_targeting_is_currently_only_available_when")}{" "}
                <Link
                  href="https://formbricks.com//docs/app-surveys/user-identification"
                  target="blank"
                  className="underline">
                  {t("environments.segments.identifying_users")}
                </Link>{" "}
                {t("environments.segments.with_the_formbricks_sdk")}.
              </span>
            </AlertDescription>
          </Alert>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
}

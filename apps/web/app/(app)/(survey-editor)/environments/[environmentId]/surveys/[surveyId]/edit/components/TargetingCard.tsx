"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { AlertCircle, CheckIcon, ChevronDownIcon, ChevronUpIcon, PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
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
import { Alert, AlertDescription } from "@formbricks/ui/components/Alert";
import { AlertDialog } from "@formbricks/ui/components/AlertDialog";
import { BasicAddFilterModal } from "@formbricks/ui/components/BasicAddFilterModal";
import { BasicSegmentEditor } from "@formbricks/ui/components/BasicSegmentEditor";
import { Button } from "@formbricks/ui/components/Button";
import { LoadSegmentModal } from "@formbricks/ui/components/LoadSegmentModal";
import { SaveAsNewSegmentModal } from "@formbricks/ui/components/SaveAsNewSegmentModal";
import { SegmentTitle } from "@formbricks/ui/components/SegmentTitle";
import { TargetingIndicator } from "@formbricks/ui/components/TargetingIndicator";
import { UpgradePlanNotice } from "@formbricks/ui/components/UpgradePlanNotice";
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
  const t = useTranslations();
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
  const [parent] = useAutoAnimate();

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="w-full overflow-hidden rounded-lg border border-slate-300 bg-white">
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
            <p className="font-semibold text-slate-800">{t("environments.surveys.edit.target_audience")}</p>
            <p className="mt-1 text-sm text-slate-500">
              {t("environments.surveys.edit.pre_segment_your_users_with_attributes_filters")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>
      <Collapsible.CollapsibleContent className="flex min-w-full flex-col overflow-auto" ref={parent}>
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
                    {t(
                      "environments.surveys.edit.this_is_an_advanced_segment_please_upgrade_your_plan_to_edit_it"
                    )}
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
                              {t("environments.surveys.edit.send_survey_to_audience_who_match")}
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
                          {t("common.add_filter")}
                        </Button>

                        {isSegmentEditorOpen && !segment?.isPrivate && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              handleSaveSegment({ filters: segment?.filters ?? [] });
                            }}>
                            {t("common.save_changes")}
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
                            {t("common.cancel")}
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
                          {segmentEditorViewOnly ? t("common.hide_filters") : t("common.view_filters")}{" "}
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
                            {t("environments.surveys.edit.clone_edit_segment")}
                          </Button>
                        )}

                        {!isSegmentUsedInOtherSurveys && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              handleEditSegment();
                            }}>
                            {t("environments.surveys.edit.edit_segment")}
                            <PencilIcon className="ml-2 h-3 w-3" />
                          </Button>
                        )}
                      </div>
                      {isSegmentUsedInOtherSurveys && (
                        <p className="mt-1 flex items-center text-xs text-slate-500">
                          <AlertCircle className="mr-1 inline h-3 w-3" />
                          {t("environments.surveys.edit.this_segment_is_used_in_other_surveys_make_changes")}
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
              {t("environments.surveys.edit.load_segment")}
            </Button>

            {!segment?.isPrivate && !!segment?.filters?.length && (
              <Button variant="secondary" size="sm" onClick={() => setResetAllFiltersModalOpen(true)}>
                {t("common.reset_all_filters")}
              </Button>
            )}

            {isSegmentEditorOpen && !!segment?.filters?.length && (
              <Button
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setSaveAsNewSegmentModalOpen(true)}>
                {t("environments.surveys.edit.save_as_new_segment")}
              </Button>
            )}
          </div>
          <div className="-mt-1.5">
            {isFormbricksCloud ? (
              <UpgradePlanNotice
                message={t("environments.surveys.edit.for_advanced_targeting_please")}
                textForUrl={t("environments.surveys.edit.upgrade_to_the_scale_plan")}
                url={`/environments/${environmentId}/settings/billing`}
              />
            ) : (
              <UpgradePlanNotice
                message={t("environments.surveys.edit.for_advanced_targeting_please")}
                textForUrl={t("common.request_an_enterprise_license")}
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
          headerText={t("common.are_you_sure")}
          open={resetAllFiltersModalOpen}
          setOpen={setResetAllFiltersModalOpen}
          mainText={t("environments.surveys.edit.this_action_resets_all_filters_in_this_survey")}
          declineBtnLabel={t("common.cancel")}
          onDecline={() => {
            setResetAllFiltersModalOpen(false);
          }}
          confirmBtnLabel={t("environments.surveys.edit.remove_all_filters")}
          onConfirm={async () => {
            const segment = await handleResetAllFilters();
            if (segment) {
              toast.success(t("common.filters_reset_successfully"));
              router.refresh();
              setSegment(segment);
              setResetAllFiltersModalOpen(false);
            }
          }}
        />

        <div>
          <Alert className="flex items-center rounded-none bg-slate-50">
            <AlertDescription className="ml-2">
              <span className="mr-1 text-slate-600">
                {t("environments.surveys.edit.user_targeting_is_currently_only_available_when")}
                <Link
                  href="https://formbricks.com//docs/app-surveys/user-identification"
                  target="blank"
                  className="underline">
                  {t("environments.surveys.edit.identifying_users")}
                </Link>{" "}
                {t("environments.surveys.edit.with_the_formbricks_sdk")}
              </span>
            </AlertDescription>
          </Alert>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

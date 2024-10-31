"use client";

import { FilterIcon, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { structuredClone } from "@formbricks/lib/pollyfills/structuredClone";
import { isAdvancedSegment } from "@formbricks/lib/segment/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TBaseFilter, TSegment, TSegmentWithSurveyNames, ZSegmentFilters } from "@formbricks/types/segment";
import { BasicAddFilterModal } from "@formbricks/ui/components/BasicAddFilterModal";
import { BasicSegmentEditor } from "@formbricks/ui/components/BasicSegmentEditor";
import { Button } from "@formbricks/ui/components/Button";
import { ConfirmDeleteSegmentModal } from "@formbricks/ui/components/ConfirmDeleteSegmentModal";
import { Input } from "@formbricks/ui/components/Input";
import { UpgradePlanNotice } from "@formbricks/ui/components/UpgradePlanNotice";
import { deleteBasicSegmentAction, updateBasicSegmentAction } from "../actions";

type TBasicSegmentSettingsTabProps = {
  environmentId: string;
  setOpen: (open: boolean) => void;
  initialSegment: TSegmentWithSurveyNames;
  attributeClasses: TAttributeClass[];
  isFormbricksCloud: boolean;
};

export const BasicSegmentSettings = ({
  environmentId,
  initialSegment,
  setOpen,
  attributeClasses,
  isFormbricksCloud,
}: TBasicSegmentSettingsTabProps) => {
  const router = useRouter();
  const t = useTranslations();
  const [addFilterModalOpen, setAddFilterModalOpen] = useState(false);
  const [segment, setSegment] = useState<TSegment>(initialSegment);

  const [isUpdatingSegment, setIsUpdatingSegment] = useState(false);
  const [isDeletingSegment, setIsDeletingSegment] = useState(false);

  const [isDeleteSegmentModalOpen, setIsDeleteSegmentModalOpen] = useState(false);

  const handleResetState = () => {
    setSegment(initialSegment);
    setOpen(false);

    router.refresh();
  };

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

  const handleUpdateSegment = async () => {
    if (!segment.title) {
      toast.error(t("environments.segments.title_is_required"));
      return;
    }

    try {
      setIsUpdatingSegment(true);
      await updateBasicSegmentAction({
        segmentId: segment.id,
        data: {
          title: segment.title,
          description: segment.description ?? "",
          isPrivate: segment.isPrivate,
          filters: segment.filters,
        },
      });

      setIsUpdatingSegment(false);
      toast.success(t("environments.segments.segment_updated_successfully"));
    } catch (err: any) {
      // parse the segment filters to check if they are valid
      const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
      if (!parsedFilters.success) {
        toast.error(t("environments.segments.invalid_filters_please_check_the_filters_and_try_again"));
      } else {
        toast.error(t("common.something_went_wrong_please_try_again"));
      }
      setIsUpdatingSegment(false);
      return;
    }

    setIsUpdatingSegment(false);
    handleResetState();
    router.refresh();
  };

  const handleDeleteSegment = async () => {
    try {
      setIsDeletingSegment(true);
      await deleteBasicSegmentAction({ segmentId: segment.id });

      setIsDeletingSegment(false);
      toast.success(t("environments.segments.segment_deleted_successfully"));
      handleResetState();
    } catch (err: any) {
      toast.error(t("common.something_went_wrong_please_try_again"));
    }

    setIsDeletingSegment(false);
  };

  const isSaveDisabled = useMemo(() => {
    // check if title is empty

    if (!segment.title) {
      return true;
    }

    // parse the filters to check if they are valid
    const parsedFilters = ZSegmentFilters.safeParse(segment.filters);
    if (!parsedFilters.success) {
      return true;
    }

    return false;
  }, [segment]);

  if (isAdvancedSegment(segment.filters)) {
    return (
      <p className="italic text-slate-600">
        {t("environments.segments.advance_segment_cannot_be_edited_upgrade_your_plan")}
      </p>
    );
  }

  return (
    <>
      <div className="mb-4">
        <div className="rounded-lg bg-slate-50">
          <div className="flex flex-col overflow-auto rounded-lg bg-white">
            <div className="flex w-full items-center gap-4">
              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">{t("common.title")}</label>
                <div className="relative flex flex-col gap-1">
                  <Input
                    value={segment.title}
                    placeholder={t("environments.segments.ex_power_users")}
                    onChange={(e) => {
                      setSegment((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }));
                    }}
                    className="w-auto"
                  />
                </div>
              </div>

              <div className="flex w-1/2 flex-col gap-2">
                <label className="text-sm font-medium text-slate-900">{t("common.description")}</label>
                <div className="relative flex flex-col gap-1">
                  <Input
                    value={segment.description ?? ""}
                    placeholder={t("environments.segments.ex_fully_activated_recurring_users")}
                    onChange={(e) => {
                      setSegment((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }));
                    }}
                    className="w-auto"
                  />
                </div>
              </div>
            </div>

            <label className="my-4 text-sm font-medium text-slate-900">{t("common.targeting")}</label>
            <div className="filter-scrollbar flex max-h-96 w-full flex-col gap-4 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
              {segment?.filters?.length === 0 && (
                <div className="-mb-2 flex items-center gap-1">
                  <FilterIcon className="h-5 w-5 text-slate-700" />
                  <h3 className="text-sm font-medium text-slate-700">
                    {t("environments.segments.add_your_first_filter_to_get_started")}
                  </h3>
                </div>
              )}

              <BasicSegmentEditor
                environmentId={environmentId}
                segment={segment}
                setSegment={setSegment}
                group={segment.filters}
                attributeClasses={attributeClasses}
              />

              <div>
                <Button variant="secondary" size="sm" onClick={() => setAddFilterModalOpen(true)}>
                  {t("common.add_filter")}
                </Button>
              </div>

              <BasicAddFilterModal
                onAddFilter={(filter) => {
                  handleAddFilterInGroup(filter);
                }}
                open={addFilterModalOpen}
                setOpen={setAddFilterModalOpen}
                attributeClasses={attributeClasses}
              />
            </div>

            {isFormbricksCloud ? (
              <UpgradePlanNotice
                message={t("environments.segments.for_advanced_targeting_please")}
                textForUrl={t("environments.segments.upgrade_your_plan")}
                url={`/environments/${environmentId}/settings/billing`}
              />
            ) : (
              <UpgradePlanNotice
                message={t("environments.segments.for_advanced_targeting_please")}
                textForUrl={t("common.request_an_enterprise_license")}
                url={`/environments/${environmentId}/settings/enterprise`}
              />
            )}

            <div className="flex w-full items-center justify-between pt-4">
              <Button
                type="button"
                variant="warn"
                loading={isDeletingSegment}
                onClick={() => {
                  setIsDeleteSegmentModalOpen(true);
                }}
                EndIcon={Trash2}
                endIconClassName="p-0.5">
                {t("common.delete")}
              </Button>
              <Button
                type="submit"
                loading={isUpdatingSegment}
                onClick={() => {
                  handleUpdateSegment();
                }}
                disabled={isSaveDisabled}>
                {t("common.save_changes")}
              </Button>
            </div>

            {isDeleteSegmentModalOpen && (
              <ConfirmDeleteSegmentModal
                onDelete={handleDeleteSegment}
                open={isDeleteSegmentModalOpen}
                segment={initialSegment}
                setOpen={setIsDeleteSegmentModalOpen}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
};

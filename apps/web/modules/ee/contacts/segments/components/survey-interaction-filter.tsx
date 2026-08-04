"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  SURVEY_INTERACTION_OPERATORS,
  SURVEY_INTERACTION_TIME_UNITS,
  type TSegmentSurveyInteractionFilter,
  type TSegmentSurveyInteractionFilterValue,
  type TSurveyInteractionOperator,
  type TSurveyInteractionTimeUnit,
} from "@formbricks/types/segment";
import { structuredClone } from "@/lib/pollyfills/structuredClone";
import {
  convertOperatorToText,
  updateOperatorInFilter,
  updateSurveyInteractionValueInFilter,
} from "@/modules/ee/contacts/segments/lib/utils";
import { Input } from "@/modules/ui/components/input";
import { MultiSelect } from "@/modules/ui/components/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { getSurveysForSegmentFilterAction } from "../actions";
import {
  SegmentFilterItemConnector,
  SegmentFilterItemContextMenu,
  type TBaseFilterProps,
} from "./segment-filter";

type TSurveyInteractionFilterProps = TBaseFilterProps & {
  onAddFilterBelow: () => void;
  resource: TSegmentSurveyInteractionFilter;
};

export function SurveyInteractionFilter({
  connector,
  onAddFilterBelow,
  onCreateGroup,
  onDeleteFilter,
  onMoveFilter,
  resource,
  segment,
  setSegment,
  viewOnly,
}: Readonly<TSurveyInteractionFilterProps>) {
  const { t } = useTranslation();
  // Pin to the concrete value type: the filter's `value` field is inferred from a refined Zod schema,
  // which TypeScript does not treat as a plain (spreadable) object without this annotation.
  const value: TSegmentSurveyInteractionFilterValue = resource.value;
  const [surveys, setSurveys] = useState<{ id: string; name: string; status: string }[]>([]);

  // Load the workspace's surveys once so the "specific surveys" picker is ready the moment the user
  // switches scope. Self-fetching here avoids prop-drilling surveys through the four SegmentEditor
  // render sites.
  useEffect(() => {
    let active = true;
    const loadSurveys = async () => {
      try {
        const result = await getSurveysForSegmentFilterAction({ workspaceId: segment.workspaceId });
        if (active && result?.data) {
          setSurveys(result.data);
        }
      } catch (error) {
        // Non-fatal: the picker just stays empty. Log so a failing action is observable rather than
        // silently swallowed.
        console.error("Failed to load surveys for segment filter", error);
      }
    };
    void loadSurveys();
    return () => {
      active = false;
    };
  }, [segment.workspaceId]);

  const commitValue = (newValue: TSegmentSurveyInteractionFilterValue) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateSurveyInteractionValueInFilter(updatedSegment.filters, resource.id, newValue);
    }
    setSegment(updatedSegment);
  };

  const updateOperatorInSegment = (newOperator: TSurveyInteractionOperator) => {
    const updatedSegment = structuredClone(segment);
    if (updatedSegment.filters) {
      updateOperatorInFilter(updatedSegment.filters, resource.id, newOperator);
    }
    setSegment(updatedSegment);
  };

  const operatorArr = SURVEY_INTERACTION_OPERATORS.map((operator) => ({
    id: operator,
    name: convertOperatorToText(operator, t),
  }));

  const getTimeUnitLabel = (unit: TSurveyInteractionTimeUnit, amount: number) => {
    const isSingular = amount === 1;
    switch (unit) {
      case "days":
        return isSingular ? t("workspace.segments.time_unit_day") : t("workspace.segments.time_unit_days");
      case "weeks":
        return isSingular ? t("workspace.segments.time_unit_week") : t("workspace.segments.time_unit_weeks");
      case "months":
        return isSingular
          ? t("workspace.segments.time_unit_month")
          : t("workspace.segments.time_unit_months");
    }
  };

  // Exclude the surveys this segment already gates (in the survey editor that's the survey being
  // edited): targeting a segment by interaction with a survey it controls is circular.
  const excludedSurveyIds = new Set(segment.surveys ?? []);
  const surveyOptions = surveys
    .filter((survey) => !excludedSurveyIds.has(survey.id))
    .map((survey) => ({
      // Name is the primary label (id beneath it as secondary); search matches both name and id.
      value: survey.id,
      label: survey.name || survey.id,
      description: survey.id,
    }));

  const handleAmountChange = (raw: string) => {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isNaN(parsed)) return;
    const clamped = Math.min(999, Math.max(1, parsed));
    commitValue({ ...value, within: { ...value.within, amount: clamped } });
  };

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-2">
        <SegmentFilterItemConnector
          connector={connector}
          filterId={resource.id}
          key={connector}
          segment={segment}
          setSegment={setSegment}
          viewOnly={viewOnly}
        />

        <Select
          disabled={viewOnly}
          onValueChange={(operator: TSurveyInteractionOperator) => {
            updateOperatorInSegment(operator);
          }}
          value={resource.qualifier.operator}>
          <SelectTrigger
            aria-label={t("workspace.segments.survey_interaction")}
            className="flex w-auto items-center justify-center bg-white whitespace-nowrap"
            hideArrow>
            <SelectValue placeholder={t("common.select")} />
          </SelectTrigger>

          <SelectContent>
            {operatorArr.map((operator) => (
              <SelectItem key={operator.id} value={operator.id}>
                {operator.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          disabled={viewOnly}
          onValueChange={(scope: "any" | "specific") => {
            commitValue({ ...value, surveyScope: scope });
          }}
          value={value.surveyScope}>
          <SelectTrigger
            aria-label={t("common.surveys")}
            className="flex w-auto items-center justify-center bg-white whitespace-nowrap"
            hideArrow>
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="any">{t("workspace.segments.any_survey")}</SelectItem>
            <SelectItem value="specific">{t("workspace.segments.specific_surveys")}</SelectItem>
          </SelectContent>
        </Select>

        <p className="whitespace-nowrap text-slate-600">{t("workspace.segments.within_last")}</p>

        <Input
          aria-label={t("workspace.segments.number")}
          className="h-9 w-16 bg-white"
          disabled={viewOnly}
          max={999}
          min={1}
          onChange={(e) => {
            if (viewOnly) return;
            handleAmountChange(e.target.value);
          }}
          step={1}
          type="number"
          value={value.within.amount}
        />

        <Select
          disabled={viewOnly}
          onValueChange={(unit: TSurveyInteractionTimeUnit) => {
            commitValue({ ...value, within: { ...value.within, unit } });
          }}
          value={value.within.unit}>
          <SelectTrigger
            aria-label={t("workspace.segments.period")}
            className="flex w-auto items-center justify-center bg-white whitespace-nowrap"
            hideArrow>
            <SelectValue>{getTimeUnitLabel(value.within.unit, value.within.amount)}</SelectValue>
          </SelectTrigger>

          <SelectContent>
            {SURVEY_INTERACTION_TIME_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {getTimeUnitLabel(unit, value.within.amount)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <SegmentFilterItemContextMenu
          filterId={resource.id}
          onAddFilterBelow={onAddFilterBelow}
          onCreateGroup={onCreateGroup}
          onDeleteFilter={onDeleteFilter}
          onMoveFilter={onMoveFilter}
          viewOnly={viewOnly}
        />
      </div>

      {value.surveyScope === "specific" ? (
        <div className="ml-[48px] flex flex-col gap-1 rounded-lg border border-slate-300 bg-white p-3">
          <p className="text-xs font-medium text-slate-500">{t("common.surveys")}</p>
          <MultiSelect
            disabled={viewOnly}
            onChange={(selected) => {
              commitValue({ ...value, surveyIds: selected });
            }}
            options={surveyOptions}
            placeholder={t("common.select")}
            value={value.surveyIds}
          />
          {value.surveyIds.length === 0 ? (
            <p className="text-xs text-red-500">{t("workspace.segments.select_at_least_one_survey")}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

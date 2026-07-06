"use client";

import { CheckIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { Button } from "@/modules/ui/components/button";

export interface TPlanColumn {
  key: string;
  name: string;
  description: string;
  amount: string;
  periodLabel: string;
  isPopular: boolean;
  currentBadge: boolean;
  pendingBadge: boolean;
  mostPopularLabel: string;
  currentBadgeLabel: string;
  pendingBadgeLabel: string;
  ctaLabel: string;
  ctaVariant: "default" | "secondary";
  ctaDisabled: boolean;
  ctaLoading: boolean;
  onCtaClick: () => void;
}

// A comparison cell value: true → included (check), false → not included (—),
// the sentinel string "addon" → available as a paid add-on, or any other plain
// string (e.g. "3", "2,000"). ("addon" is a string, so the union stays boolean | string.)
type ComparisonValue = boolean | string;

type ComparisonDisplayRow =
  | { type: "feature"; label: string; values: ComparisonValue[] }
  | { type: "section"; label: string };

// Vertical compartment line + horizontal padding shared by every plan-column cell.
const PLAN_CELL = "border-l border-slate-100 px-3 sm:px-5";
const LABEL_CELL = "px-3 sm:px-5";
// Highlight band running down the most popular (Pro) plan.
const HIGHLIGHT = "bg-[#D1EFED]/60";

// Shared plan comparison for the a-b_billing_plan-comparison-table experiment ("test").
// Plan headers (badges, price, CTA) sit on top, a "Best for" row below the CTAs, and the full
// feature matrix below that with the Pro plan highlighted. "Compare all details" reveals the
// features shared by every plan.
export const PlanComparisonTable = ({ columns }: Readonly<{ columns: TPlanColumn[] }>) => {
  const { t } = useTranslation();
  const [showDetails, setShowDetails] = useState(false);

  const renderValue = (value: ComparisonValue): ReactNode => {
    if (value === true) {
      return (
        <>
          <CheckIcon className="size-5 text-emerald-600" strokeWidth={3} aria-hidden="true" />
          <span className="sr-only">{t("workspace.settings.billing.comparison_included")}</span>
        </>
      );
    }
    if (value === false) {
      return (
        <>
          <span aria-hidden="true" className="text-slate-300">
            —
          </span>
          <span className="sr-only">{t("workspace.settings.billing.comparison_not_included")}</span>
        </>
      );
    }
    if (value === "addon")
      return <span className="text-slate-500">{t("workspace.settings.billing.comparison_addon")}</span>;
    return <span className="text-slate-700">{value}</span>;
  };

  const proUnlocks: ComparisonDisplayRow[] = [
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_hide_branding"),
      values: [false, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_contact_management"),
      values: [false, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_attribute_segmentation"),
      values: [false, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_email_followups"),
      values: [false, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_ai_translations"),
      values: [false, true, true],
    },
  ];

  const allPlans: ComparisonDisplayRow[] = [
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_link_surveys"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_inproduct_surveys"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_question_types"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_conditional_logic"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_hidden_fields"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_partial_responses"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_recall"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_backgrounds"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_file_uploads"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_single_use_links"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_api"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_frankfurt"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_unlimited_seats"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_respondent_id"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_all_integrations"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_custom_webhooks"),
      values: [true, true, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_mobile_sdks"),
      values: [true, true, true],
    },
  ];

  const scaleUnlocks: ComparisonDisplayRow[] = [
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_teams_roles"),
      values: [false, false, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_quota"),
      values: [false, false, true],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_unify_feedback"),
      values: [false, false, "addon"],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_topic_labeling"),
      values: [false, false, "addon"],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_custom_dashboards"),
      values: [false, false, "addon"],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_two_factor_auth"),
      values: [false, false, "addon"],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_spam"),
      values: [false, false, "addon"],
    },
  ];

  const displayRows: ComparisonDisplayRow[] = [
    { type: "section", label: t("workspace.settings.billing.comparison_section_basic_usage") },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_workspaces"),
      values: ["1", "3", "5"],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_responses"),
      values: ["250", "2,000", "5,000"],
    },
    {
      type: "feature",
      label: t("workspace.settings.billing.comparison_row_overage"),
      values: [false, true, true],
    },
    { type: "section", label: t("workspace.settings.billing.comparison_section_pro_unlocks") },
    ...proUnlocks,
    ...(showDetails
      ? [
          {
            type: "section",
            label: t("workspace.settings.billing.comparison_section_all_plans"),
          } as ComparisonDisplayRow,
          ...allPlans,
          {
            type: "section",
            label: t("workspace.settings.billing.comparison_section_scale_unlocks"),
          } as ComparisonDisplayRow,
          ...scaleUnlocks,
        ]
      : []),
  ];

  return (
    <div className="overflow-x-auto">
      <div
        role="table"
        aria-label={t("workspace.settings.billing.plan_selection_title")}
        className="grid min-w-[42rem] grid-cols-[minmax(0,0.5fr)_repeat(3,minmax(0,1fr))]">
        {/* Plan header row — badges, name, price, aligned CTA */}
        <div role="row" className="contents">
          <div role="columnheader" className={LABEL_CELL} />
          {columns.map((col) => (
            <div
              key={col.key}
              role="columnheader"
              className={cn(
                "flex flex-col pt-6",
                PLAN_CELL,
                col.isPopular && cn(HIGHLIGHT, "rounded-t-2xl")
              )}>
              <div className="mb-4 flex min-h-7 items-start gap-2">
                {col.isPopular && (
                  <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                    {col.mostPopularLabel}
                  </span>
                )}
                {col.currentBadge && (
                  <span className="rounded-md bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
                    {col.currentBadgeLabel}
                  </span>
                )}
                {col.pendingBadge && (
                  <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
                    {col.pendingBadgeLabel}
                  </span>
                )}
              </div>
              <h3 className="text-2xl font-semibold text-slate-900 sm:text-3xl">{col.name}</h3>
              <div className="mt-4 flex min-h-12 flex-wrap items-end gap-x-2">
                <span className="text-2xl font-normal tracking-tight text-slate-900 sm:text-3xl">
                  {col.amount}
                </span>
                <span className="pb-1 text-sm text-slate-500">{col.periodLabel}</span>
              </div>
              <Button
                variant={col.ctaVariant}
                className="mt-4 w-full"
                disabled={col.ctaDisabled}
                loading={col.ctaLoading}
                onClick={col.onCtaClick}>
                {col.ctaLabel}
              </Button>
            </div>
          ))}
        </div>

        {/* Best for (plan descriptions right below the CTAs, above the separator) */}
        <div role="row" className="contents">
          <div role="rowheader" className={cn(LABEL_CELL, "pt-6 pb-6 text-sm font-medium text-slate-600")}>
            {t("workspace.settings.billing.comparison_best_for")}
          </div>
          {columns.map((col) => (
            <div
              key={col.key}
              role="cell"
              className={cn(
                PLAN_CELL,
                "pt-6 pb-6 text-sm leading-6 text-slate-500",
                col.isPopular && HIGHLIGHT
              )}>
              {col.description}
            </div>
          ))}
        </div>

        {/* Feature comparison rows (grouped by section) */}
        {displayRows.map((row, rowIndex) => {
          const hasTopBorder = rowIndex === 0 || row.type === "section";
          const isSection = row.type === "section";
          const isLastRow = rowIndex === displayRows.length - 1;
          return (
            <div key={`${row.type}-${row.label}-${rowIndex}`} role="row" className="contents">
              <div
                role="rowheader"
                className={cn(
                  LABEL_CELL,
                  hasTopBorder && "border-t border-slate-100",
                  isSection
                    ? "pt-8 pb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase"
                    : "py-3 text-sm text-slate-600",
                  isLastRow && "pb-6"
                )}>
                {row.label}
              </div>
              {columns.map((col, columnIndex) => (
                <div
                  key={col.key}
                  role="cell"
                  className={cn(
                    PLAN_CELL,
                    "flex justify-center text-center",
                    hasTopBorder && "border-t border-slate-100",
                    isSection ? "pt-8 pb-2" : "py-3 text-sm",
                    isLastRow && "pb-6",
                    col.isPopular && HIGHLIGHT,
                    col.isPopular && isLastRow && "rounded-b-2xl"
                  )}>
                  {row.type === "feature" ? renderValue(row.values[columnIndex]) : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-8 flex justify-center">
        <Button variant="secondary" onClick={() => setShowDetails((prev) => !prev)}>
          {showDetails
            ? t("workspace.settings.billing.plan_comparison_hide_details")
            : t("workspace.settings.billing.plan_comparison_see_details")}
        </Button>
      </div>
    </div>
  );
};

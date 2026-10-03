"use client";

import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getAIUnavailableMessage } from "@/lib/ai/availability";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { cn } from "@/lib/cn";
import {
  CHART_PRESET_IDS,
  type TChartPresetId,
  getChartPresetCopy,
} from "@/modules/ee/analysis/charts/lib/chart-presets";
import { CHART_VALUE_BAND_COLORS } from "@/modules/ee/analysis/charts/lib/chart-utils";
import { AiIcon } from "@/modules/ui/components/ai";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";

interface CreateChartChooserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The directory the chart will read from, named under the title. */
  directoryName?: string;
  onPreset: (presetId: TChartPresetId) => void;
  onBlank: () => void;
  onDescribe: () => void;
  isAIAvailable?: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

const CARD_CLASS =
  "flex rounded-lg border border-slate-200 bg-white text-left transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-brand-dark focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-white";

const LineThumbnail = () => (
  <svg viewBox="0 0 96 48" className="h-12 w-full" aria-hidden="true">
    <line x1="4" y1="24" x2="92" y2="24" className="stroke-slate-200" strokeWidth="1" />
    <polyline
      points="4,30 18,22 30,26 44,14 58,18 72,10 92,14"
      fill="none"
      stroke={CHART_VALUE_BAND_COLORS.positive}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// A three-slice donut in the band colors, drawn as dashed circles: 55% / 28% / 17%.
const DonutThumbnail = () => {
  const circumference = 2 * Math.PI * 16;
  const slices = [
    { share: 0.55, color: CHART_VALUE_BAND_COLORS.positive },
    { share: 0.28, color: CHART_VALUE_BAND_COLORS.neutral },
    { share: 0.17, color: CHART_VALUE_BAND_COLORS.negative },
  ];
  let offset = 0;
  return (
    <svg viewBox="0 0 96 48" className="h-12 w-full" aria-hidden="true">
      <g transform="rotate(-90 48 24)">
        {slices.map(({ share, color }) => {
          const length = share * circumference;
          const circle = (
            <circle
              key={color}
              cx="48"
              cy="24"
              r="16"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={`${Math.max(length - 1.5, 0)} ${circumference}`}
              strokeDashoffset={-offset}
            />
          );
          offset += length;
          return circle;
        })}
      </g>
    </svg>
  );
};

interface WideCardProps {
  icon: ReactNode;
  title: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
}

const WideCard = ({ icon, title, hint, onClick, disabled }: Readonly<WideCardProps>) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(CARD_CLASS, "w-full items-center gap-3 p-4")}>
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700">
      {icon}
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-medium text-slate-800">{title}</span>
      <span className="block text-xs text-slate-500">{hint}</span>
    </span>
  </button>
);

/**
 * The first step of making a chart: start from a metric that opens the builder already configured,
 * from a blank builder, or from a prompt. Picking a card is the action — there is nothing to confirm.
 */
export function CreateChartChooserDialog({
  open,
  onOpenChange,
  directoryName,
  onPreset,
  onBlank,
  onDescribe,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<CreateChartChooserDialogProps>) {
  const { t } = useTranslation();

  const presetCopy = getChartPresetCopy(t);

  // AI off with no reason to give (nothing the viewer could change) hides the card; with a reason it
  // stays visible but disabled, and says why.
  const isAIOff = isAIAvailable === false;
  const showDescribe = !isAIOff || Boolean(aiUnavailableReason);
  const describeCard = (
    <WideCard
      icon={<AiIcon />}
      title={t("workspace.analysis.charts.describe_it")}
      hint={t("workspace.analysis.charts.describe_it_hint")}
      onClick={onDescribe}
      disabled={isAIOff}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent width="wide">
        <DialogHeader>
          <DialogTitle>{t("workspace.analysis.charts.create_chart_chooser_title")}</DialogTitle>
          {directoryName && <DialogDescription>{directoryName}</DialogDescription>}
        </DialogHeader>
        <DialogBody className="space-y-5">
          <section aria-labelledby="chart-chooser-metrics" className="space-y-3">
            <div>
              <h3 id="chart-chooser-metrics" className="text-sm font-medium text-slate-800">
                {t("workspace.analysis.charts.start_from_metric")}
              </h3>
              <p className="text-xs text-slate-500">
                {t("workspace.analysis.charts.start_from_metric_hint")}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {CHART_PRESET_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPreset(id)}
                  className={cn(CARD_CLASS, "flex-col gap-3 p-3")}>
                  <span className="rounded-md bg-slate-50 px-2 py-1.5">
                    {id.endsWith("_over_time") ? <LineThumbnail /> : <DonutThumbnail />}
                  </span>
                  <span>
                    <span className="block text-sm font-medium text-slate-800">{presetCopy[id].name}</span>
                    <span className="block text-xs text-slate-500">{presetCopy[id].description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <div className="grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 md:grid-cols-2">
            <WideCard
              icon={<PlusIcon className="size-4" />}
              title={t("workspace.analysis.charts.blank_chart")}
              hint={t("workspace.analysis.charts.blank_chart_hint")}
              onClick={onBlank}
            />
            {showDescribe &&
              (isAIOff ? (
                <TooltipRenderer
                  tooltipContent={getAIUnavailableMessage(aiUnavailableReason, t)}
                  triggerClass="block">
                  {describeCard}
                </TooltipRenderer>
              ) : (
                describeCard
              ))}
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}

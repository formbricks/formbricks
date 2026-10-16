"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DateTimePicker,
  useEditorTimeZone,
  validateDateTimeRange,
} from "@/modules/ui/components/date-time-picker";
import { NumberStepper } from "@/modules/ui/components/number-stepper";
import { PageContentWrapper } from "@/modules/ui/components/page-content-wrapper";
import { PageHeader } from "@/modules/ui/components/page-header";
import type { TCreativeDisplayState } from "../../lib/display-status";
import { getCreativesPath } from "../../lib/paths";
import { CreativeStatusPill } from "../creative-status-pill";

// A living spec for the kit pieces Creatives adds. apps/storybook only renders packages/survey-ui,
// so apps/web components are reviewed here, inside the real app shell, theme and i18n.

const KitSection = ({
  title,
  description,
  children,
}: Readonly<{ title: string; description: string; children: React.ReactNode }>) => (
  <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
    <header className="space-y-1">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="max-w-2xl text-sm text-slate-500">{description}</p>
    </header>
    <div className="grid gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  </section>
);

const Demo = ({
  label,
  value,
  children,
}: Readonly<{ label: string; value?: string; children: React.ReactNode }>) => (
  <div className="space-y-2">
    <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
    {children}
    {value !== undefined && (
      <code className="block truncate rounded-md bg-slate-50 px-2 py-1 font-mono text-xs text-slate-500">
        {value}
      </code>
    )}
  </div>
);

const STATUS_STATES: TCreativeDisplayState[] = [
  { status: "draft", reason: null },
  { status: "scheduled", reason: null },
  { status: "active", reason: null },
  { status: "paused", reason: null },
  { status: "paused", reason: "survey_not_active" },
  { status: "closed", reason: "schedule_ended" },
  { status: "archived", reason: null },
];

export const CreativesKitPlayground = ({ workspaceId }: Readonly<{ workspaceId: string }>) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en-US";
  const timeZone = useEditorTimeZone();
  const [single, setSingle] = useState<Date | null>(null);
  const [preset, setPreset] = useState<Date | null>(() => {
    const date = new Date();
    date.setHours(9, 0, 0, 0);
    return date;
  });
  const [start, setStart] = useState<Date | null>(null);
  const [end, setEnd] = useState<Date | null>(null);
  const [fontSize, setFontSize] = useState(16);
  const [offset, setOffset] = useState(50);
  const [opacity, setOpacity] = useState(0.8);
  const [bounded, setBounded] = useState(2);
  const rangeError = validateDateTimeRange(start, end);
  // The browser's zone differs from the server's, so the instants are only written out after hydration.
  const describe = (date: Date | null) => (timeZone ? (date ? date.toISOString() : "null") : "");

  return (
    <PageContentWrapper>
      <Link
        href={getCreativesPath(workspaceId)}
        className="-mb-2 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeftIcon className="size-4" />
        {t("common.creatives")}
      </Link>
      <PageHeader pageTitle={t("workspace.creatives.kit_title")}>
        <p className="pb-4 text-sm text-slate-500">{t("workspace.creatives.kit.description")}</p>
      </PageHeader>

      <KitSection
        title={t("workspace.creatives.kit.date_time_picker")}
        description={t("workspace.creatives.kit.date_time_picker_description")}>
        <Demo label={t("workspace.creatives.kit.empty")} value={describe(single)}>
          <DateTimePicker
            locale={locale}
            value={single}
            onChange={setSingle}
            placeholder={t("workspace.creatives.editor.starts_placeholder")}
          />
        </Demo>
        <Demo label={t("workspace.creatives.kit.with_value")} value={describe(preset)}>
          <DateTimePicker locale={locale} value={preset} onChange={setPreset} />
        </Demo>
        <Demo label={t("workspace.creatives.kit.disabled")}>
          <DateTimePicker locale={locale} value={preset} onChange={setPreset} disabled />
        </Demo>
        <Demo label={t("workspace.creatives.kit.range_start")} value={describe(start)}>
          <DateTimePicker
            locale={locale}
            value={start}
            onChange={setStart}
            placeholder={t("workspace.creatives.editor.starts_placeholder")}
          />
        </Demo>
        <Demo label={t("workspace.creatives.kit.range_end")} value={describe(end)}>
          <DateTimePicker
            locale={locale}
            value={end}
            onChange={setEnd}
            minDate={start ?? undefined}
            placeholder={t("workspace.creatives.editor.ends_placeholder")}
            error={rangeError ? t("workspace.creatives.editor.end_before_start") : undefined}
          />
        </Demo>
      </KitSection>

      <KitSection
        title={t("workspace.creatives.kit.number_stepper")}
        description={t("workspace.creatives.kit.number_stepper_description")}>
        <Demo label={t("workspace.creatives.kit.pixels")} value={String(fontSize)}>
          <NumberStepper
            aria-label={t("workspace.creatives.editor.font_size")}
            value={fontSize}
            onChange={setFontSize}
            min={10}
            max={32}
            unit="px"
          />
        </Demo>
        <Demo label={t("workspace.creatives.kit.percent_step")} value={String(offset)}>
          <NumberStepper
            aria-label={t("workspace.creatives.editor.offset")}
            value={offset}
            onChange={setOffset}
            min={0}
            max={100}
            step={5}
            unit="%"
          />
        </Demo>
        <Demo label={t("workspace.creatives.kit.decimal_step")} value={String(opacity)}>
          <NumberStepper
            aria-label={t("workspace.creatives.kit.decimal_step")}
            value={opacity}
            onChange={setOpacity}
            min={0}
            max={1}
            step={0.05}
          />
        </Demo>
        <Demo label={t("workspace.creatives.kit.at_bounds")} value={String(bounded)}>
          <NumberStepper
            aria-label={t("workspace.creatives.kit.at_bounds")}
            value={bounded}
            onChange={setBounded}
            min={0}
            max={2}
          />
        </Demo>
        <Demo label={t("workspace.creatives.kit.disabled")}>
          <NumberStepper
            aria-label={t("workspace.creatives.kit.disabled")}
            value={12}
            onChange={() => {}}
            unit="px"
            disabled
          />
        </Demo>
      </KitSection>

      <KitSection
        title={t("workspace.creatives.kit.status_badge")}
        description={t("workspace.creatives.kit.status_badge_description")}>
        <Demo label={t("common.status")}>
          <div className="flex flex-wrap gap-2">
            {STATUS_STATES.map((state) => (
              <CreativeStatusPill key={`${state.status}-${state.reason}`} state={state} />
            ))}
          </div>
        </Demo>
      </KitSection>
    </PageContentWrapper>
  );
};

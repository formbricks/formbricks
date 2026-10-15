"use client";

import { MonitorIcon, MoveIcon, PaletteIcon, ScalingIcon, SmartphoneIcon, TypeIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { NumberStepper } from "@/modules/ui/components/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";
import { MOCK_WORKSPACE_THEME } from "../../mock/data";
import type { TCreative, TCreativeDevice, TCreativeLayout, TCreativeStyling } from "../../types";
import { EditorField, EditorPanel, Segmented } from "./editor-primitives";

const FONT_WEIGHTS: TCreativeStyling["fontWeight"][] = [400, 500, 600, 700];

export const StylingTab = ({
  creative,
  onChange,
  device,
  onDeviceChange,
}: Readonly<{
  creative: TCreative;
  onChange: (creative: TCreative) => void;
  device: TCreativeDevice;
  onDeviceChange: (device: TCreativeDevice) => void;
}>) => {
  const { t } = useTranslation();
  const ids = useId();
  const { styling } = creative;
  const layout = creative.layout[device];
  const setStyling = (patch: Partial<TCreativeStyling>) =>
    onChange({ ...creative, styling: { ...styling, ...patch } });
  const setLayout = (patch: Partial<TCreativeLayout>) =>
    onChange({ ...creative, layout: { ...creative.layout, [device]: { ...layout, ...patch } } });
  const isFeedbackButton = creative.type === "feedback_button";

  const weightLabels: Record<TCreativeStyling["fontWeight"], string> = {
    400: t("workspace.creatives.editor.weight_regular"),
    500: t("workspace.creatives.editor.weight_medium"),
    600: t("workspace.creatives.editor.weight_semibold"),
    700: t("workspace.creatives.editor.weight_bold"),
  };
  const colorFields: { key: "backgroundColor" | "textColor" | "borderColor"; label: string }[] = [
    { key: "backgroundColor", label: t("workspace.creatives.editor.background_color") },
    { key: "textColor", label: t("workspace.creatives.editor.text_color") },
    { key: "borderColor", label: t("workspace.creatives.editor.border_color") },
  ];

  return (
    <>
      <EditorPanel title={t("workspace.creatives.editor.colors")} icon={PaletteIcon}>
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={`${ids}-theme`} className="space-y-0.5">
            <span className="block text-sm font-medium text-slate-900">
              {t("workspace.creatives.editor.theme_note_title")}
            </span>
            <span className="block text-xs text-slate-500">
              {t("workspace.creatives.editor.theme_note_description")}
            </span>
          </label>
          <Switch
            id={`${ids}-theme`}
            checked={styling.useWorkspaceTheme}
            onCheckedChange={(useWorkspaceTheme) =>
              setStyling(
                useWorkspaceTheme ? { useWorkspaceTheme, ...MOCK_WORKSPACE_THEME } : { useWorkspaceTheme }
              )
            }
          />
        </div>
        {styling.useWorkspaceTheme ? (
          <div className="flex items-center gap-2" aria-hidden="true">
            {colorFields.map(({ key }) => (
              <span
                key={key}
                className="size-6 rounded-full border border-slate-200 shadow-xs"
                style={{ background: styling[key] }}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {colorFields.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-4">
                <p className="text-sm text-slate-700">{label}</p>
                <ColorPicker
                  containerClass="w-44"
                  color={styling[key]}
                  onChange={(color) => setStyling({ [key]: color })}
                />
              </div>
            ))}
          </div>
        )}
      </EditorPanel>

      <EditorPanel title={t("workspace.creatives.editor.text_and_shape")} icon={TypeIcon}>
        <div className="grid gap-4 sm:grid-cols-3">
          <EditorField label={t("workspace.creatives.editor.font")} htmlFor={`${ids}-font-family`}>
            <Select
              value={styling.font}
              onValueChange={(font) => setStyling({ font: font as TCreativeStyling["font"] })}>
              <SelectTrigger id={`${ids}-font-family`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inherit">{t("workspace.creatives.editor.font_inherit")}</SelectItem>
                <SelectItem value="survey">{t("workspace.creatives.editor.font_survey")}</SelectItem>
              </SelectContent>
            </Select>
          </EditorField>
          <EditorField label={t("workspace.creatives.editor.font_weight")} htmlFor={`${ids}-weight`}>
            <Select
              value={String(styling.fontWeight)}
              onValueChange={(weight) =>
                setStyling({ fontWeight: Number(weight) as TCreativeStyling["fontWeight"] })
              }>
              <SelectTrigger id={`${ids}-weight`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_WEIGHTS.map((weight) => (
                  <SelectItem key={weight} value={String(weight)}>
                    {weightLabels[weight]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </EditorField>
          {isFeedbackButton && (
            <EditorField label={t("workspace.creatives.editor.corner_radius")} htmlFor={`${ids}-radius`}>
              <NumberStepper
                id={`${ids}-radius`}
                value={Math.min(styling.radius, 32)}
                onChange={(radius) => setStyling({ radius })}
                min={0}
                max={32}
                unit="px"
              />
            </EditorField>
          )}
        </div>
      </EditorPanel>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-2">
        <span className="text-sm text-slate-600">
          {t("workspace.creatives.editor.size_and_position_for")}
        </span>
        <Segmented
          ariaLabel={t("workspace.creatives.editor.size_and_position_for")}
          value={device}
          onChange={onDeviceChange}
          options={[
            { value: "desktop", label: t("workspace.creatives.editor.desktop"), icon: MonitorIcon },
            { value: "phone", label: t("common.phone"), icon: SmartphoneIcon },
          ]}
        />
      </div>

      <EditorPanel title={t("workspace.creatives.editor.position")} icon={MoveIcon}>
        {isFeedbackButton ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-slate-700">{t("workspace.creatives.editor.edge")}</p>
              <Segmented
                fill
                ariaLabel={t("workspace.creatives.editor.edge")}
                value={layout.edge}
                onChange={(edge) => setLayout({ edge })}
                options={[
                  { value: "left", label: t("workspace.creatives.editor.left") },
                  { value: "right", label: t("workspace.creatives.editor.right") },
                  { value: "bottom", label: t("workspace.creatives.editor.bottom") },
                ]}
              />
            </div>
            <EditorField
              label={t("workspace.creatives.editor.offset")}
              htmlFor={`${ids}-offset`}
              hint={
                layout.edge === "bottom"
                  ? t("workspace.creatives.editor.from_left")
                  : t("workspace.creatives.editor.from_top")
              }>
              <NumberStepper
                id={`${ids}-offset`}
                value={layout.offset}
                onChange={(offset) => setLayout({ offset })}
                min={0}
                max={100}
                step={5}
                unit="%"
              />
            </EditorField>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-slate-700">{t("workspace.creatives.editor.edge")}</p>
            <Segmented
              ariaLabel={t("workspace.creatives.editor.edge")}
              value={layout.bannerPosition}
              onChange={(bannerPosition) => setLayout({ bannerPosition })}
              options={[
                { value: "top", label: t("workspace.creatives.editor.top") },
                { value: "bottom", label: t("workspace.creatives.editor.bottom") },
              ]}
            />
          </div>
        )}
      </EditorPanel>

      <EditorPanel title={t("common.size")} icon={ScalingIcon}>
        <div className="grid gap-4 sm:grid-cols-3">
          <EditorField label={t("workspace.creatives.editor.font_size")} htmlFor={`${ids}-font`}>
            <NumberStepper
              id={`${ids}-font`}
              value={layout.fontSize}
              onChange={(fontSize) => setLayout({ fontSize })}
              min={10}
              max={32}
              unit="px"
            />
          </EditorField>
          <EditorField label={t("workspace.creatives.editor.padding_x")} htmlFor={`${ids}-padding-x`}>
            <NumberStepper
              id={`${ids}-padding-x`}
              value={layout.paddingX}
              onChange={(paddingX) => setLayout({ paddingX })}
              min={0}
              max={48}
              unit="px"
            />
          </EditorField>
          <EditorField label={t("workspace.creatives.editor.padding_y")} htmlFor={`${ids}-padding-y`}>
            <NumberStepper
              id={`${ids}-padding-y`}
              value={layout.paddingY}
              onChange={(paddingY) => setLayout({ paddingY })}
              min={0}
              max={48}
              unit="px"
            />
          </EditorField>
        </div>
      </EditorPanel>
    </>
  );
};

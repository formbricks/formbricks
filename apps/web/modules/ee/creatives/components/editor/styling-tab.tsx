"use client";

import {
  AlertTriangleIcon,
  MonitorIcon,
  MoonIcon,
  MoveIcon,
  PaletteIcon,
  RotateCcwIcon,
  ScalingIcon,
  SmartphoneIcon,
  SunIcon,
} from "lucide-react";
import { type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import { CREATIVE_ROOT_CLASS, type TCreativeStyle } from "@formbricks/creatives";
import type { TStylingAppearance } from "@/lib/styling/dark-mode";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import type { TCustomCssValidationState } from "@/modules/custom-css/components/lib/validation";
import { Alert, AlertDescription } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ColorPicker } from "@/modules/ui/components/color-picker";
import { NumberStepper } from "@/modules/ui/components/number-stepper";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { StylingAppearanceProvider } from "@/modules/ui/components/styling-appearance";
import { Switch } from "@/modules/ui/components/switch";
import { type TCreativeContrastWarning, getCreativeContrastWarning } from "../../lib/contrast";
import type { TCreativeColorKey } from "../../lib/creative";
import { CUSTOM_STYLE_PANELS } from "../../lib/editor-panels";
import { getColorsSummary, getPositionSummary, getShapeSummary } from "../../lib/panel-summaries";
import {
  type TBannerPlacement,
  type TCreativeDevice,
  type TCreativeSizeKey,
  type TCreativeStylingForm,
  type TFeedbackButtonPlacement,
  getDevicePlacement,
  getOwnColor,
  toBannerPlacement,
  withColorValue,
  withDevicePlacement,
  withPosition,
  withSizeValue,
  withTheme,
} from "../../lib/styling-form";
import { CustomCssPanel, type TCreativeCustomCssConfig } from "./custom-css-panel";
import { EditorField, EditorPanel, Segmented, useEditorPanels } from "./editor-primitives";
import { ColorsSummary, PositionSummary, ShapeSummary } from "./panel-summaries";

const FONT_WEIGHTS = [400, 500, 600, 700] as const;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
// Long enough to outlast a drag in the colour picker, like the survey's contrast warnings.
const WARNINGS_SETTLE_MS = 400;
// The API's bounds (v3 Creatives `styling.theme`).
const SIZE_BOUNDS: Record<TCreativeSizeKey, { min: number; max: number }> = {
  fontSize: { min: 8, max: 72 },
  paddingX: { min: 0, max: 64 },
  paddingY: { min: 0, max: 64 },
};

type TFontChoice = "workspace" | "page" | "survey";

const FONT_CHOICE_VALUES: Record<TFontChoice, boolean | null> = {
  workspace: null,
  page: true,
  survey: false,
};

/** The Font select's value: the creative's own Page font override, or the workspace setting. */
const toFontChoice = (pageFont: boolean | null | undefined): TFontChoice => {
  if (pageFont === true) return "page";
  if (pageFont === false) return "survey";
  return "workspace";
};

const isFontChoice = (value: string): value is TFontChoice => value in FONT_CHOICE_VALUES;

/** A field whose value can be handed back to the workspace look, or on phone to the desktop value. */
const OverridableField = ({
  label,
  htmlFor,
  hint,
  resetLabel,
  onReset,
  children,
}: Readonly<{
  label: string;
  htmlFor?: string;
  /** Shown while the field follows the workspace or the desktop value. */
  hint: string;
  resetLabel: string;
  /** Present while the field is set here. */
  onReset?: () => void;
  children: ReactNode;
}>) => (
  <div className="space-y-1.5">
    <div className="flex min-h-5 items-center justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {onReset ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-5 text-slate-500"
          onClick={onReset}
          aria-label={resetLabel}
          title={resetLabel}>
          <RotateCcwIcon className="size-3.5" aria-hidden="true" />
        </Button>
      ) : (
        <span className="truncate text-xs text-slate-400" title={hint}>
          {hint}
        </span>
      )}
    </div>
    {children}
  </div>
);

const DeviceSwitch = ({
  device,
  onChange,
}: Readonly<{ device: TCreativeDevice; onChange: (device: TCreativeDevice) => void }>) => {
  const { t } = useTranslation();
  return (
    <Segmented
      ariaLabel={t("workspace.creatives.editor.size_and_position_for")}
      value={device}
      onChange={onChange}
      options={[
        { value: "desktop", label: t("workspace.creatives.editor.desktop"), icon: MonitorIcon },
        { value: "phone", label: t("common.phone"), icon: SmartphoneIcon },
      ]}
    />
  );
};

/**
 * Light / Dark, at the top of each card that differs by appearance (Colors, Custom CSS): in the body, as
 * a folding card's header is only its toggle. Every copy drives the one appearance the preview's sun /
 * moon switch drives too.
 */
const AppearanceSwitch = ({
  appearance,
  onChange,
}: Readonly<{ appearance: TStylingAppearance; onChange: (appearance: TStylingAppearance) => void }>) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm font-medium text-slate-700">{t("common.appearance")}</span>
      <Segmented
        ariaLabel={t("common.appearance")}
        value={appearance}
        onChange={onChange}
        options={[
          { value: "light", label: t("workspace.look.appearance_light"), icon: SunIcon },
          { value: "dark", label: t("workspace.look.appearance_dark"), icon: MoonIcon },
        ]}
      />
    </div>
  );
};

/**
 * The contrast of the appearance being edited, like the survey's dark contrast warnings, once the
 * colours stop changing, so the warning and the Colors header's dot don't flicker mid-drag.
 */
const useSettledContrastWarning = (
  style: TCreativeStyle,
  appearance: TStylingAppearance
): TCreativeContrastWarning | null => {
  // Debounced as a string: the style is a new object on every render.
  const settled = useDebouncedValue(
    JSON.stringify(getCreativeContrastWarning(style, appearance)),
    WARNINGS_SETTLE_MS
  );
  const warning = JSON.parse(settled) as TCreativeContrastWarning | null;
  // Switching appearance hides the other one's warning at once rather than after the delay.
  return warning?.appearance === appearance ? warning : null;
};

const ContrastWarning = ({ warning }: Readonly<{ warning: TCreativeContrastWarning }>) => {
  const { t } = useTranslation();
  const values = { ratio: warning.ratio.toFixed(1) };
  return (
    <output className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
      <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        {/* Literal keys keep the i18n scanner happy. */}
        {warning.appearance === "dark"
          ? t("workspace.creatives.editor.contrast_warning_dark", values)
          : t("workspace.creatives.editor.contrast_warning_light", values)}
      </span>
    </output>
  );
};

/**
 * The Styling tab (ENG-3580, ENG-4005): "Add custom styles" over the cards Colors · Shape & size ·
 * Position · Custom CSS. A creative starts from the workspace Look & Feel; with custom styles on, each
 * field set here overrides it, and a reset hands it back. Position is edited with custom styles off too.
 * Only colours and Custom CSS differ by appearance, so Light / Dark sits in those two cards (one state,
 * also the preview's); Shape & size and Position are shared by both appearances and have Desktop and
 * Phone values instead, where the device switch also turns the preview. Each card folds to a row that
 * summarises its values (`panel-summaries.ts`).
 */
export const StylingTab = ({
  styling,
  onChange,
  style,
  workspaceStyle,
  device,
  onDeviceChange,
  appearance,
  onAppearanceChange,
  customCss,
}: Readonly<{
  styling: TCreativeStylingForm;
  onChange: (styling: TCreativeStylingForm) => void;
  /** The computed look: what a field left to the workspace, or to desktop, shows. */
  style: TCreativeStyle;
  /** The same creative without custom styles: what "Workspace setting" means for it. */
  workspaceStyle: TCreativeStyle;
  device: TCreativeDevice;
  onDeviceChange: (device: TCreativeDevice) => void;
  appearance: TStylingAppearance;
  onAppearanceChange: (appearance: TStylingAppearance) => void;
  customCss: { config: TCreativeCustomCssConfig; validation: TCustomCssValidationState };
}>) => {
  const { t } = useTranslation();
  const ids = useId();
  const { setPanelsOpen } = useEditorPanels();
  const contrastWarning = useSettledContrastWarning(style, appearance);
  const { theme } = styling;
  const isOn = theme.customStyles;
  const { element } = style;
  const isPhone = device === "phone";
  const isDark = appearance === "dark";
  const setTheme = (patch: Parameters<typeof withTheme>[1]) => onChange(withTheme(styling, patch));

  const workspaceValue = t("workspace.creatives.editor.workspace_value");
  const useWorkspaceValue = t("workspace.creatives.editor.use_workspace_value");
  const colorHint = isDark ? t("workspace.creatives.editor.automatic_value") : workspaceValue;
  const colorResetLabel = isDark ? t("workspace.look.appearance_use_automatic") : useWorkspaceValue;
  const weightLabels: Record<number, string> = {
    400: t("workspace.creatives.editor.weight_regular"),
    500: t("workspace.creatives.editor.weight_medium"),
    600: t("workspace.creatives.editor.weight_semibold"),
    700: t("workspace.creatives.editor.weight_bold"),
  };
  const workspaceWeight = workspaceStyle.element.fontWeight;
  const colorFields: { key: TCreativeColorKey; label: string }[] = [
    { key: "backgroundColor", label: t("workspace.creatives.editor.background_color") },
    { key: "textColor", label: t("workspace.creatives.editor.text_color") },
    { key: "borderColor", label: t("workspace.creatives.editor.border_color") },
  ];
  const sizeFields: { key: TCreativeSizeKey; label: string }[] = [
    { key: "fontSize", label: t("workspace.creatives.editor.font_size") },
    { key: "paddingX", label: t("workspace.creatives.editor.padding_x") },
    { key: "paddingY", label: t("workspace.creatives.editor.padding_y") },
  ];

  // A dark colour needs a light one: a colour left to the workspace takes the light colour on screen.
  const setColor = (key: TCreativeColorKey, value: string | null) => {
    const patch = withColorValue(theme, key, appearance, value, element.light[key]);
    if (patch) setTheme(patch);
  };
  // In dark, a colour can be set once light has one to keep: not for a border light doesn't show.
  const canSetColor = (key: TCreativeColorKey) =>
    !isDark || theme[key] !== null || element.light[key] !== null;

  const appearanceSwitch = <AppearanceSwitch appearance={appearance} onChange={onAppearanceChange} />;

  return (
    <StylingAppearanceProvider appearance={appearance}>
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor={`${ids}-custom`} className="space-y-0.5">
            <span className="block text-sm font-semibold text-slate-900">
              {t("workspace.creatives.editor.custom_styles")}
            </span>
            <span className="block text-xs text-slate-500">
              {styling.type === "feedbackButton"
                ? t("workspace.creatives.editor.custom_styles_description_feedback_button")
                : t("workspace.creatives.editor.custom_styles_description_banner")}
            </span>
          </label>
          <Switch
            id={`${ids}-custom`}
            checked={isOn}
            onCheckedChange={(customStyles) => {
              setTheme({ customStyles });
              // Off locks these cards, so they close; on, Colors opens as the place to start.
              setPanelsOpen(customStyles ? ["colors"] : CUSTOM_STYLE_PANELS, customStyles);
            }}
          />
        </div>
      </section>

      <EditorPanel
        title={t("workspace.creatives.editor.colors")}
        icon={PaletteIcon}
        fold={{
          id: "colors",
          summary: (
            <ColorsSummary
              summary={getColorsSummary(styling, style, appearance)}
              appearance={appearance}
              contrastRatio={contrastWarning?.ratio ?? null}
            />
          ),
          attention: contrastWarning ? "warning" : undefined,
        }}>
        {appearanceSwitch}
        {isDark && (
          <Alert variant="info" size="small">
            <AlertDescription className="whitespace-normal">
              {t("workspace.creatives.editor.appearance_dark_description")}
            </AlertDescription>
          </Alert>
        )}
        <fieldset disabled={!isOn} className="min-w-0 space-y-3 disabled:opacity-60">
          {colorFields.map(({ key, label }) => {
            const own = getOwnColor(theme, key, appearance);
            const shown = element[appearance][key];
            const canSet = canSetColor(key);
            return (
              <OverridableField
                key={key}
                label={label}
                htmlFor={`${ids}-${key}`}
                hint={canSet ? colorHint : t("workspace.creatives.editor.set_in_light_first")}
                resetLabel={colorResetLabel}
                onReset={isOn && own !== null ? () => setColor(key, null) : undefined}>
                <ColorPicker
                  id={`${ids}-${key}`}
                  color={isOn ? (own ?? "") : ""}
                  placeholderColor={shown ?? undefined}
                  placeholder={shown === null ? t("workspace.creatives.editor.no_border") : undefined}
                  onChange={(value) => {
                    // The picker reports partial input too; only a full `#rrggbb` is a colour the API takes.
                    if (HEX_COLOR.test(value)) setColor(key, value.toLowerCase());
                  }}
                  disabled={!isOn || !canSet}
                />
              </OverridableField>
            );
          })}
        </fieldset>
        {contrastWarning && <ContrastWarning warning={contrastWarning} />}
      </EditorPanel>

      <EditorPanel
        title={t("workspace.creatives.editor.shape_and_size")}
        icon={ScalingIcon}
        fold={{
          id: "shapeAndSize",
          summary: <ShapeSummary summary={getShapeSummary(styling, style, device)} device={device} />,
        }}>
        <fieldset disabled={!isOn} className="min-w-0 space-y-4 disabled:opacity-60">
          <div className="space-y-3">
            <EditorField label={t("workspace.look.font")} htmlFor={`${ids}-font`}>
              <Select
                value={isOn ? toFontChoice(theme.pageFont) : "workspace"}
                onValueChange={(value) => {
                  if (isFontChoice(value)) setTheme({ pageFont: FONT_CHOICE_VALUES[value] });
                }}
                disabled={!isOn}>
                <SelectTrigger id={`${ids}-font`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">
                    {t("workspace.creatives.editor.workspace_setting", {
                      value: workspaceStyle.pageFont
                        ? t("workspace.look.font_page")
                        : t("workspace.look.font_survey"),
                    })}
                  </SelectItem>
                  <SelectItem value="page">{t("workspace.look.font_page")}</SelectItem>
                  <SelectItem value="survey">{t("workspace.look.font_survey")}</SelectItem>
                </SelectContent>
              </Select>
            </EditorField>
            <EditorField label={t("workspace.creatives.editor.font_weight")} htmlFor={`${ids}-weight`}>
              <Select
                value={isOn && theme.fontWeight !== null ? String(theme.fontWeight) : "workspace"}
                onValueChange={(value) =>
                  setTheme({ fontWeight: FONT_WEIGHTS.find((weight) => String(weight) === value) ?? null })
                }
                disabled={!isOn}>
                <SelectTrigger id={`${ids}-weight`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workspace">
                    {t("workspace.creatives.editor.workspace_setting", {
                      value: weightLabels[workspaceWeight] ?? String(workspaceWeight),
                    })}
                  </SelectItem>
                  {FONT_WEIGHTS.map((weight) => (
                    <SelectItem key={weight} value={String(weight)}>
                      {weightLabels[weight]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditorField>
            {styling.type === "feedbackButton" && (
              <div className="max-w-60">
                <OverridableField
                  label={t("workspace.creatives.editor.corner_radius")}
                  htmlFor={`${ids}-radius`}
                  hint={workspaceValue}
                  resetLabel={useWorkspaceValue}
                  onReset={
                    isOn && styling.theme.borderRadius !== null
                      ? () => onChange({ ...styling, theme: { ...styling.theme, borderRadius: null } })
                      : undefined
                  }>
                  <NumberStepper
                    id={`${ids}-radius`}
                    value={element.borderRadius}
                    onChange={(borderRadius) =>
                      onChange({ ...styling, theme: { ...styling.theme, borderRadius } })
                    }
                    min={0}
                    max={100}
                    unit="px"
                    disabled={!isOn}
                  />
                </OverridableField>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">{t("common.size")}</span>
              <DeviceSwitch device={device} onChange={onDeviceChange} />
            </div>
            <div className="max-w-60 space-y-3">
              {sizeFields.map(({ key, label }) => (
                <OverridableField
                  key={key}
                  label={label}
                  htmlFor={`${ids}-${key}`}
                  hint={isPhone ? t("workspace.creatives.editor.same_as_desktop") : workspaceValue}
                  resetLabel={isPhone ? t("workspace.creatives.editor.use_desktop_value") : useWorkspaceValue}
                  onReset={
                    isOn && theme[key][device] !== null
                      ? () => setTheme(withSizeValue(theme, key, device, null))
                      : undefined
                  }>
                  <NumberStepper
                    id={`${ids}-${key}`}
                    value={element[device][key]}
                    onChange={(value) => setTheme(withSizeValue(theme, key, device, value))}
                    {...SIZE_BOUNDS[key]}
                    unit="px"
                    disabled={!isOn}
                  />
                </OverridableField>
              ))}
            </div>
            <p className="text-xs text-slate-500">{t("workspace.creatives.editor.phone_values_note")}</p>
          </div>
        </fieldset>
      </EditorPanel>

      <PositionPanel styling={styling} onChange={onChange} device={device} onDeviceChange={onDeviceChange} />

      <CustomCssPanel
        className={CREATIVE_ROOT_CLASS[styling.type]}
        source={theme.customCss}
        onChange={(source) => setTheme({ customCss: source })}
        validation={customCss.validation}
        config={customCss.config}
        disabled={!isOn}
        appearanceSwitch={appearanceSwitch}
      />
    </StylingAppearanceProvider>
  );
};

/** Position applies with custom styles on or off: the edge and offset, or a banner's edge and Layout. */
const PositionPanel = ({
  styling,
  onChange,
  device,
  onDeviceChange,
}: Readonly<{
  styling: TCreativeStylingForm;
  onChange: (styling: TCreativeStylingForm) => void;
  device: TCreativeDevice;
  onDeviceChange: (device: TCreativeDevice) => void;
}>) => {
  const { t } = useTranslation();
  const ids = useId();
  const hasOwnPhonePlacement = styling.position.phone !== null;
  const followsDesktop = device === "phone" && !hasOwnPhonePlacement;
  const resetLabel = t("workspace.creatives.editor.use_desktop_position");

  return (
    <EditorPanel
      title={t("workspace.creatives.editor.position")}
      icon={MoveIcon}
      description={t("workspace.creatives.editor.position_description")}
      fold={{
        id: "position",
        summary: <PositionSummary summary={getPositionSummary(styling, device)} device={device} />,
      }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-slate-500">
          {followsDesktop && t("workspace.creatives.editor.same_as_desktop")}
        </span>
        <div className="flex items-center gap-1">
          {device === "phone" && hasOwnPhonePlacement && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-slate-500"
              onClick={() => onChange(withPosition(styling, { ...styling.position, phone: null }))}
              aria-label={resetLabel}
              title={resetLabel}>
              <RotateCcwIcon className="size-3.5" aria-hidden="true" />
            </Button>
          )}
          <DeviceSwitch device={device} onChange={onDeviceChange} />
        </div>
      </div>

      {styling.type === "feedbackButton" ? (
        <FeedbackButtonPosition
          placement={getDevicePlacement(styling.position, device)}
          onChange={(placement) =>
            onChange({ ...styling, position: withDevicePlacement(styling.position, device, placement) })
          }
          offsetId={`${ids}-offset`}
        />
      ) : (
        <BannerPosition
          placement={getDevicePlacement(styling.position, device)}
          onChange={(placement) =>
            onChange({ ...styling, position: withDevicePlacement(styling.position, device, placement) })
          }
        />
      )}
    </EditorPanel>
  );
};

const FeedbackButtonPosition = ({
  placement,
  onChange,
  offsetId,
}: Readonly<{
  placement: TFeedbackButtonPlacement;
  onChange: (placement: TFeedbackButtonPlacement) => void;
  offsetId: string;
}>) => {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-700">{t("workspace.creatives.editor.edge")}</p>
        <Segmented
          fill
          ariaLabel={t("workspace.creatives.editor.edge")}
          value={placement.edge}
          onChange={(edge) => onChange({ ...placement, edge })}
          options={[
            { value: "left", label: t("workspace.creatives.editor.left") },
            { value: "right", label: t("workspace.creatives.editor.right") },
            { value: "bottom", label: t("workspace.creatives.editor.bottom") },
          ]}
        />
      </div>
      <EditorField
        label={t("workspace.creatives.editor.offset")}
        htmlFor={offsetId}
        hint={
          placement.edge === "bottom"
            ? t("workspace.creatives.editor.from_left")
            : t("workspace.creatives.editor.from_top")
        }>
        <NumberStepper
          id={offsetId}
          value={placement.offset}
          onChange={(offset) => onChange({ ...placement, offset })}
          min={0}
          max={100}
          step={5}
          unit="%"
        />
      </EditorField>
    </div>
  );
};

const BannerPosition = ({
  placement,
  onChange,
}: Readonly<{ placement: TBannerPlacement; onChange: (placement: TBannerPlacement) => void }>) => {
  const { t } = useTranslation();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-700">{t("workspace.creatives.editor.edge")}</p>
        <Segmented
          fill
          ariaLabel={t("workspace.creatives.editor.edge")}
          value={placement.placement}
          onChange={(edge) => onChange(toBannerPlacement(edge))}
          options={[
            { value: "top", label: t("workspace.creatives.editor.top") },
            { value: "bottom", label: t("workspace.creatives.editor.bottom") },
          ]}
        />
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-medium text-slate-700">{t("workspace.creatives.editor.layout")}</p>
        {placement.placement === "bottom" ? (
          <p className="text-xs text-slate-500">{t("workspace.creatives.editor.layout_bottom_overlay")}</p>
        ) : (
          <Segmented
            fill
            ariaLabel={t("workspace.creatives.editor.layout")}
            value={placement.layout}
            onChange={(layout) => onChange(toBannerPlacement("top", layout))}
            options={[
              { value: "inPage", label: t("workspace.creatives.editor.layout_in_page") },
              { value: "overlay", label: t("workspace.creatives.editor.layout_overlay") },
            ]}
          />
        )}
      </div>
      {placement.placement === "top" && (
        <p className="text-xs text-slate-500 sm:col-span-2">
          {placement.layout === "inPage"
            ? t("workspace.creatives.editor.layout_in_page_description")
            : t("workspace.creatives.editor.layout_overlay_description")}
        </p>
      )}
    </div>
  );
};

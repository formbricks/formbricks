"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { CheckIcon } from "lucide-react";
import React, { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { TProjectStyling } from "@formbricks/types/project";
import { TSurveyStyling } from "@formbricks/types/surveys/types";
import { cn } from "@/lib/cn";
import {
  ColorField,
  DimensionInput,
  NumberField,
  StylingSection,
  TextField,
} from "@/modules/ui/components/styling-fields";

type FormStylingSettingsProps = {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isSettingsPage?: boolean;
  disabled?: boolean;
  form: UseFormReturn<TProjectStyling | TSurveyStyling>;
};

export const FormStylingSettings = ({
  open,
  isSettingsPage = false,
  disabled = false,
  setOpen,
  form,
}: FormStylingSettingsProps) => {
  const { t } = useTranslation();

  const [parent] = useAutoAnimate();
  const [headlinesOpen, setHeadlinesOpen] = useState(false);
  const [inputsOpen, setInputsOpen] = useState(false);
  const [buttonsOpen, setButtonsOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={(openState) => {
        if (disabled) return;
        setOpen(openState);
      }}
      className="w-full rounded-lg border border-slate-300 bg-white">
      <Collapsible.CollapsibleTrigger
        asChild
        disabled={disabled}
        className={cn(
          "w-full cursor-pointer rounded-lg hover:bg-slate-50",
          disabled && "cursor-not-allowed opacity-60 hover:bg-white"
        )}>
        <div className="inline-flex px-4 py-4">
          {!isSettingsPage && (
            <div className="flex items-center pl-2 pr-5">
              <CheckIcon
                strokeWidth={3}
                className="h-7 w-7 rounded-full border border-green-300 bg-green-100 p-1.5 text-green-600"
              />
            </div>
          )}

          <div>
            <p className={cn("font-semibold text-slate-800", isSettingsPage ? "text-sm" : "text-base")}>
              {t("environments.surveys.edit.survey_styling")}
            </p>
            <p className={cn("mt-1 text-slate-500", isSettingsPage ? "text-xs" : "text-sm")}>
              {t("environments.surveys.edit.style_the_question_texts_descriptions_and_input_fields")}
            </p>
          </div>
        </div>
      </Collapsible.CollapsibleTrigger>

      <Collapsible.CollapsibleContent className="flex flex-col" ref={parent}>
        <hr className="py-1 text-slate-600" />

        <div className="flex flex-col gap-6 p-6">
          {/* Headlines & Descriptions */}
          <StylingSection
            title={t("environments.workspace.look.advanced_styling_section_headlines")}
            open={headlinesOpen}
            setOpen={setHeadlinesOpen}>
            <div className="grid grid-cols-2 gap-4">
              <ColorField
                form={form}
                name="elementHeadlineColor.light"
                label={t("environments.workspace.look.advanced_styling_field_headline_color")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_headline_color_description"
                )}
              />
              <ColorField
                form={form}
                name="elementDescriptionColor.light"
                label={t("environments.workspace.look.advanced_styling_field_description_color")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_description_color_description"
                )}
              />
              <DimensionInput
                form={form}
                name="elementHeadlineFontSize"
                label={t("environments.workspace.look.advanced_styling_field_headline_size")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_headline_size_description"
                )}
              />
              <DimensionInput
                form={form}
                name="elementDescriptionFontSize"
                label={t("environments.workspace.look.advanced_styling_field_description_size")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_description_size_description"
                )}
              />
              <NumberField
                form={form}
                name="elementHeadlineFontWeight"
                label={t("environments.workspace.look.advanced_styling_field_headline_weight")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_headline_weight_description"
                )}
                step={100}
                min={100}
                max={900}
              />
              <NumberField
                form={form}
                name="elementDescriptionFontWeight"
                label={t("environments.workspace.look.advanced_styling_field_description_weight")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_description_weight_description"
                )}
                step={100}
                min={100}
                max={900}
              />
              <ColorField
                form={form}
                name="elementUpperLabelColor.light"
                label={t("environments.workspace.look.advanced_styling_field_upper_label_color")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_upper_label_color_description"
                )}
              />
              <DimensionInput
                form={form}
                name="elementUpperLabelFontSize"
                label={t("environments.workspace.look.advanced_styling_field_upper_label_size")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_upper_label_size_description"
                )}
              />
              <NumberField
                form={form}
                name="elementUpperLabelFontWeight"
                label={t("environments.workspace.look.advanced_styling_field_upper_label_weight")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_upper_label_weight_description"
                )}
                step={100}
                min={100}
                max={900}
              />
            </div>
          </StylingSection>

          {/* Inputs */}
          <StylingSection
            title={t("environments.workspace.look.advanced_styling_section_inputs")}
            open={inputsOpen}
            setOpen={setInputsOpen}>
            <div className="grid grid-cols-2 gap-4">
              <ColorField
                form={form}
                name="inputColor.light"
                label={t("environments.surveys.edit.input_color")}
                description={t("environments.surveys.edit.input_color_description")}
              />
              <ColorField
                form={form}
                name="inputBorderColor.light"
                label={t("environments.surveys.edit.input_border_color")}
                description={t("environments.surveys.edit.input_border_color_description")}
              />
              <ColorField
                form={form}
                name="inputTextColor.light"
                label={t("environments.workspace.look.advanced_styling_field_input_text")}
                description={t("environments.workspace.look.advanced_styling_field_input_text_description")}
              />
              <div className="hidden" /> {/* Spacer if needed, or remove for auto flow */}
              <DimensionInput
                form={form}
                name="inputBorderRadius"
                label={t("environments.workspace.look.advanced_styling_field_border_radius")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_input_border_radius_description"
                )}
              />
              <DimensionInput
                form={form}
                name="inputHeight"
                label={t("environments.workspace.look.advanced_styling_field_height")}
                description={t("environments.workspace.look.advanced_styling_field_input_height_description")}
              />
              <DimensionInput
                form={form}
                name="inputFontSize"
                label={t("environments.workspace.look.advanced_styling_field_font_size")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_input_font_size_description"
                )}
              />
              <DimensionInput
                form={form}
                name="inputPaddingX"
                label={t("environments.workspace.look.advanced_styling_field_padding_x")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_input_padding_x_description"
                )}
              />
              <DimensionInput
                form={form}
                name="inputPaddingY"
                label={t("environments.workspace.look.advanced_styling_field_padding_y")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_input_padding_y_description"
                )}
              />
              <NumberField
                form={form}
                name="inputPlaceholderOpacity"
                label={t("environments.workspace.look.advanced_styling_field_placeholder_opacity")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_input_placeholder_opacity_description"
                )}
                step={0.1}
                max={1}
              />
              <TextField
                form={form}
                name="inputShadow"
                label={t("environments.workspace.look.advanced_styling_field_shadow")}
                description={t("environments.workspace.look.advanced_styling_field_input_shadow_description")}
              />
            </div>
          </StylingSection>

          {/* Buttons */}
          <StylingSection
            title={t("environments.workspace.look.advanced_styling_section_buttons")}
            open={buttonsOpen}
            setOpen={setButtonsOpen}>
            <div className="grid grid-cols-2 gap-4">
              <ColorField
                form={form}
                name="buttonBgColor.light"
                label={t("environments.workspace.look.advanced_styling_field_button_bg")}
                description={t("environments.workspace.look.advanced_styling_field_button_bg_description")}
              />
              <ColorField
                form={form}
                name="buttonTextColor.light"
                label={t("environments.workspace.look.advanced_styling_field_button_text")}
                description={t("environments.workspace.look.advanced_styling_field_button_text_description")}
              />
              <DimensionInput
                form={form}
                name="buttonBorderRadius"
                label={t("environments.workspace.look.advanced_styling_field_border_radius")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_button_border_radius_description"
                )}
              />
              <DimensionInput
                form={form}
                name="buttonHeight"
                label={t("environments.workspace.look.advanced_styling_field_height")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_button_height_description"
                )}
              />
              <DimensionInput
                form={form}
                name="buttonFontSize"
                label={t("environments.workspace.look.advanced_styling_field_font_size")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_button_font_size_description"
                )}
              />
              <NumberField
                form={form}
                name="buttonFontWeight"
                label={t("environments.workspace.look.advanced_styling_field_font_weight")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_button_font_weight_description"
                )}
                step={100}
                min={100}
                max={900}
              />
              <DimensionInput
                form={form}
                name="buttonPaddingX"
                label={t("environments.workspace.look.advanced_styling_field_padding_x")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_button_padding_x_description"
                )}
              />
              <DimensionInput
                form={form}
                name="buttonPaddingY"
                label={t("environments.workspace.look.advanced_styling_field_padding_y")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_button_padding_y_description"
                )}
              />
            </div>
          </StylingSection>

          {/* Options */}
          <StylingSection
            title={t("environments.workspace.look.advanced_styling_section_options")}
            open={optionsOpen}
            setOpen={setOptionsOpen}>
            <div className="grid grid-cols-2 gap-4">
              <ColorField
                form={form}
                name="optionBgColor.light"
                label={t("environments.workspace.look.advanced_styling_field_option_bg")}
                description={t("environments.workspace.look.advanced_styling_field_option_bg_description")}
              />
              <ColorField
                form={form}
                name="optionLabelColor.light"
                label={t("environments.workspace.look.advanced_styling_field_option_label")}
                description={t("environments.workspace.look.advanced_styling_field_option_label_description")}
              />
              <ColorField
                form={form}
                name="optionBorderColor.light"
                label={t("environments.workspace.look.advanced_styling_field_option_border")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_option_border_description"
                )}
              />
              <DimensionInput
                form={form}
                name="optionBorderRadius"
                label={t("environments.workspace.look.advanced_styling_field_border_radius")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_option_border_radius_description"
                )}
              />
              <DimensionInput
                form={form}
                name="optionPaddingX"
                label={t("environments.workspace.look.advanced_styling_field_padding_x")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_option_padding_x_description"
                )}
              />
              <DimensionInput
                form={form}
                name="optionPaddingY"
                label={t("environments.workspace.look.advanced_styling_field_padding_y")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_option_padding_y_description"
                )}
              />
              <DimensionInput
                form={form}
                name="optionFontSize"
                label={t("environments.workspace.look.advanced_styling_field_font_size")}
                description={t(
                  "environments.workspace.look.advanced_styling_field_option_font_size_description"
                )}
              />
            </div>
          </StylingSection>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

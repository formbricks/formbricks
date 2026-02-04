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
              {t("environments.surveys.edit.form_styling")}
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
              />
              <ColorField
                form={form}
                name="elementDescriptionColor.light"
                label={t("environments.workspace.look.advanced_styling_field_description_color")}
              />
              <DimensionInput
                form={form}
                name="elementHeadlineFontSize"
                label={t("environments.workspace.look.advanced_styling_field_headline_size")}
              />
              <DimensionInput
                form={form}
                name="elementDescriptionFontSize"
                label={t("environments.workspace.look.advanced_styling_field_description_size")}
              />
              <NumberField
                form={form}
                name="elementHeadlineFontWeight"
                label={t("environments.workspace.look.advanced_styling_field_headline_weight")}
              />
              <ColorField
                form={form}
                name="elementUpperLabelColor.light"
                label={t("environments.workspace.look.advanced_styling_field_upper_label_color")}
              />
              <DimensionInput
                form={form}
                name="elementUpperLabelFontSize"
                label={t("environments.workspace.look.advanced_styling_field_upper_label_size")}
              />
              <NumberField
                form={form}
                name="elementUpperLabelFontWeight"
                label={t("environments.workspace.look.advanced_styling_field_upper_label_weight")}
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
              />
              <ColorField
                form={form}
                name="inputBorderColor.light"
                label={t("environments.surveys.edit.input_border_color")}
              />
              <ColorField
                form={form}
                name="inputTextColor.light"
                label={t("environments.workspace.look.advanced_styling_field_input_text")}
              />
              <div className="hidden" /> {/* Spacer if needed, or remove for auto flow */}
              <DimensionInput
                form={form}
                name="inputBorderRadius"
                label={t("environments.workspace.look.advanced_styling_field_border_radius")}
              />
              <DimensionInput
                form={form}
                name="inputHeight"
                label={t("environments.workspace.look.advanced_styling_field_height")}
              />
              <DimensionInput
                form={form}
                name="inputFontSize"
                label={t("environments.workspace.look.advanced_styling_field_font_size")}
              />
              <DimensionInput
                form={form}
                name="inputPaddingX"
                label={t("environments.workspace.look.advanced_styling_field_padding_x")}
              />
              <DimensionInput
                form={form}
                name="inputPaddingY"
                label={t("environments.workspace.look.advanced_styling_field_padding_y")}
              />
              <NumberField
                form={form}
                name="inputPlaceholderOpacity"
                label={t("environments.workspace.look.advanced_styling_field_placeholder_opacity")}
                step={0.1}
                max={1}
              />
              <TextField
                form={form}
                name="inputShadow"
                label={t("environments.workspace.look.advanced_styling_field_shadow")}
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
              />
              <ColorField
                form={form}
                name="buttonTextColor.light"
                label={t("environments.workspace.look.advanced_styling_field_button_text")}
              />
              <DimensionInput
                form={form}
                name="buttonBorderRadius"
                label={t("environments.workspace.look.advanced_styling_field_border_radius")}
              />
              <DimensionInput
                form={form}
                name="buttonHeight"
                label={t("environments.workspace.look.advanced_styling_field_height")}
              />
              <DimensionInput
                form={form}
                name="buttonFontSize"
                label={t("environments.workspace.look.advanced_styling_field_font_size")}
              />
              <NumberField
                form={form}
                name="buttonFontWeight"
                label={t("environments.workspace.look.advanced_styling_field_font_weight")}
              />
              <DimensionInput
                form={form}
                name="buttonPaddingX"
                label={t("environments.workspace.look.advanced_styling_field_padding_x")}
              />
              <DimensionInput
                form={form}
                name="buttonPaddingY"
                label={t("environments.workspace.look.advanced_styling_field_padding_y")}
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
              />
              <ColorField
                form={form}
                name="optionLabelColor.light"
                label={t("environments.workspace.look.advanced_styling_field_option_label")}
              />
              <DimensionInput
                form={form}
                name="optionBorderRadius"
                label={t("environments.workspace.look.advanced_styling_field_border_radius")}
              />
              <DimensionInput
                form={form}
                name="optionPaddingX"
                label={t("environments.workspace.look.advanced_styling_field_padding_x")}
              />
              <DimensionInput
                form={form}
                name="optionPaddingY"
                label={t("environments.workspace.look.advanced_styling_field_padding_y")}
              />
              <DimensionInput
                form={form}
                name="optionFontSize"
                label={t("environments.workspace.look.advanced_styling_field_font_size")}
              />
            </div>
          </StylingSection>
        </div>
      </Collapsible.CollapsibleContent>
    </Collapsible.Root>
  );
};

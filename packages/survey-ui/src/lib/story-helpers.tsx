import type { Decorator, StoryContext } from "@storybook/react";
import React, { useEffect, useState } from "react";

// ============================================================================
// Shared Styling Options Interfaces
// ============================================================================

export interface BaseStylingOptions {
  // Element styling
  elementHeadlineFontFamily: string;
  elementHeadlineFontSize: string;
  elementHeadlineFontWeight: string;
  elementHeadlineColor: string;
  elementDescriptionFontFamily: string;
  elementDescriptionFontWeight: string;
  elementDescriptionFontSize: string;
  elementDescriptionColor: string;
  // Input styling
  inputBgColor: string;
  inputBorderColor: string;
  inputColor: string;
  inputFontSize: string;
  inputFontWeight: string;
  // Survey styling
  brandColor: string;
}

export interface LabelStylingOptions {
  labelFontFamily: string;
  labelFontSize: string;
  labelFontWeight: string;
  labelColor: string;
  labelOpacity: string;
}

export interface InputLayoutStylingOptions {
  inputWidth: string;
  inputHeight: string;
  inputBorderRadius: string;
  inputPlaceholderColor: string;
  inputPaddingX: string;
  inputPaddingY: string;
}

export interface OptionStylingOptions {
  optionBorderColor: string;
  optionBgColor: string;
  optionLabelColor: string;
  optionBorderRadius: string;
  optionPaddingX: string;
  optionPaddingY: string;
  optionFontFamily: string;
  optionFontSize: string;
  optionFontWeight: string;
}

export interface ButtonStylingOptions {
  buttonHeight: string;
  buttonWidth: string;
  buttonFontSize: string;
  buttonBorderRadius: string;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonPaddingX: string;
  buttonPaddingY: string;
}

export interface CheckboxInputStylingOptions {
  checkboxInputBorderColor: string;
  checkboxInputBgColor: string;
  checkboxInputColor: string;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Selects a subset of argTypes by key, with type safety.
 * Useful for stories that only need specific styling controls.
 *
 * @example
 * pickArgTypes(inputStylingArgTypes, ['inputBgColor', 'inputBorderColor'])
 */
export function pickArgTypes<T extends Record<string, unknown>>(argTypes: T, keys: (keyof T)[]): Partial<T> {
  const result: Partial<T> = {};
  for (const key of keys) {
    if (key in argTypes) {
      result[key] = argTypes[key];
    }
  }
  return result;
}

// ============================================================================
// Common argTypes Configurations
// ============================================================================

export const commonArgTypes = {
  headline: {
    control: "text",
    description: "The main element text",
    table: { category: "Content" },
  },
  description: {
    control: "text",
    description: "Optional description or subheader text",
    table: { category: "Content" },
  },
  required: {
    control: "boolean",
    description: "Whether the field is required",
    table: { category: "Validation" },
  },
  errorMessage: {
    control: "text",
    description: "Error message to display",
    table: { category: "Validation" },
  },
  dir: {
    control: { type: "select" },
    options: ["ltr", "rtl", "auto"],
    description: "Text direction for RTL support",
    table: { category: "Layout" },
  },
  disabled: {
    control: "boolean",
    description: "Whether the input is disabled",
    table: { category: "State" },
  },
  onChange: {
    action: "changed",
    table: { category: "Events" },
  },
};

export const elementStylingArgTypes = {
  elementHeadlineFontFamily: {
    control: "text",
    table: { category: "Element Styling" },
  },
  elementHeadlineFontSize: {
    control: "text",
    table: { category: "Element Styling" },
  },
  elementHeadlineFontWeight: {
    control: "text",
    table: { category: "Element Styling" },
  },
  elementHeadlineColor: {
    control: "color",
    table: { category: "Element Styling" },
  },
  elementDescriptionFontFamily: {
    control: "text",
    table: { category: "Element Styling" },
  },
  elementDescriptionFontSize: {
    control: "text",
    table: { category: "Element Styling" },
  },
  elementDescriptionFontWeight: {
    control: "text",
    table: { category: "Element Styling" },
  },
  elementDescriptionColor: {
    control: "color",
    table: { category: "Element Styling" },
  },
};

export const inputStylingArgTypes = {
  inputBgColor: {
    control: "color",
    table: { category: "Input Styling" },
  },
  inputBorderColor: {
    control: "color",
    table: { category: "Input Styling" },
  },
  inputColor: {
    control: "color",
    table: { category: "Input Styling" },
  },
  inputFontSize: {
    control: "text",
    table: { category: "Input Styling" },
  },
  inputFontWeight: {
    control: "text",
    table: { category: "Input Styling" },
  },
  inputWidth: {
    control: "text",
    table: { category: "Input Styling" },
  },
  inputHeight: {
    control: "text",
    table: { category: "Input Styling" },
  },
  inputBorderRadius: {
    control: "text",
    table: { category: "Input Styling" },
  },
  inputPlaceholderColor: {
    control: "color",
    table: { category: "Input Styling" },
  },
  inputPaddingX: {
    control: "text",
    table: { category: "Input Styling" },
  },
  inputPaddingY: {
    control: "text",
    table: { category: "Input Styling" },
  },
};

export const labelStylingArgTypes = {
  labelFontFamily: {
    control: "text",
    table: { category: "Label Styling" },
  },
  labelFontSize: {
    control: "text",
    table: { category: "Label Styling" },
  },
  labelFontWeight: {
    control: "text",
    table: { category: "Label Styling" },
  },
  labelColor: {
    control: "color",
    table: { category: "Label Styling" },
  },
  labelOpacity: {
    control: "text",
    table: { category: "Label Styling" },
  },
};

export const surveyStylingArgTypes = {
  brandColor: {
    control: "color",
    table: { category: "Survey Styling" },
  },
};

export const optionStylingArgTypes = {
  optionBorderColor: {
    control: "color",
    table: { category: "Option Styling" },
  },
  optionBgColor: {
    control: "color",
    table: { category: "Option Styling" },
  },
  optionLabelColor: {
    control: "color",
    table: { category: "Option Styling" },
  },
  optionBorderRadius: {
    control: "text",
    table: { category: "Option Styling" },
  },
  optionPaddingX: {
    control: "text",
    table: { category: "Option Styling" },
  },
  optionPaddingY: {
    control: "text",
    table: { category: "Option Styling" },
  },
  optionFontFamily: {
    control: "text",
    table: { category: "Option Styling" },
  },
  optionFontSize: {
    control: "text",
    table: { category: "Option Styling" },
  },
  optionFontWeight: {
    control: "text",
    table: { category: "Option Styling" },
  },
};

export const buttonStylingArgTypes = {
  buttonHeight: {
    control: "text",
    table: { category: "Button Styling" },
  },
  buttonWidth: {
    control: "text",
    table: { category: "Button Styling" },
  },
  buttonFontSize: {
    control: "text",
    table: { category: "Button Styling" },
  },
  buttonBorderRadius: {
    control: "text",
    table: { category: "Button Styling" },
  },
  buttonBgColor: {
    control: "color",
    table: { category: "Button Styling" },
  },
  buttonTextColor: {
    control: "color",
    table: { category: "Button Styling" },
  },
  buttonPaddingX: {
    control: "text",
    table: { category: "Button Styling" },
  },
  buttonPaddingY: {
    control: "text",
    table: { category: "Button Styling" },
  },
};

// ============================================================================
// CSS Variable Mapping and Decorator Factory
// ============================================================================

type CSSVarMapping = Record<string, string>;

const CSS_VAR_MAP: CSSVarMapping = {
  elementHeadlineFontFamily: "--fb-element-headline-font-family",
  elementHeadlineFontSize: "--fb-element-headline-font-size",
  elementHeadlineFontWeight: "--fb-element-headline-font-weight",
  elementHeadlineColor: "--fb-element-headline-color",
  elementDescriptionFontFamily: "--fb-element-description-font-family",
  elementDescriptionFontSize: "--fb-element-description-font-size",
  elementDescriptionFontWeight: "--fb-element-description-font-weight",
  elementDescriptionColor: "--fb-element-description-color",
  inputBgColor: "--fb-input-bg-color",
  inputBorderColor: "--fb-input-border-color",
  inputColor: "--fb-input-color",
  inputFontSize: "--fb-input-font-size",
  inputFontWeight: "--fb-input-font-weight",
  inputWidth: "--fb-input-width",
  inputHeight: "--fb-input-height",
  inputBorderRadius: "--fb-input-border-radius",
  inputPlaceholderColor: "--fb-input-placeholder-color",
  inputPaddingX: "--fb-input-padding-x",
  inputPaddingY: "--fb-input-padding-y",
  labelFontFamily: "--fb-label-font-family",
  labelFontSize: "--fb-label-font-size",
  labelFontWeight: "--fb-label-font-weight",
  labelColor: "--fb-label-color",
  labelOpacity: "--fb-label-opacity",
  brandColor: "--fb-survey-brand-color",
  optionBorderColor: "--fb-option-border-color",
  optionBgColor: "--fb-option-bg-color",
  optionLabelColor: "--fb-option-label-color",
  optionBorderRadius: "--fb-option-border-radius",
  optionPaddingX: "--fb-option-padding-x",
  optionPaddingY: "--fb-option-padding-y",
  optionFontFamily: "--fb-option-font-family",
  optionFontSize: "--fb-option-font-size",
  optionFontWeight: "--fb-option-font-weight",
  buttonHeight: "--fb-button-height",
  buttonWidth: "--fb-button-width",
  buttonFontSize: "--fb-button-font-size",
  buttonBorderRadius: "--fb-button-border-radius",
  buttonBgColor: "--fb-button-bg-color",
  buttonTextColor: "--fb-button-text-color",
  buttonPaddingX: "--fb-button-padding-x",
  buttonPaddingY: "--fb-button-padding-y",
  checkboxInputBorderColor: "--fb-checkbox-input-border-color",
  checkboxInputBgColor: "--fb-checkbox-input-bg-color",
  checkboxInputColor: "--fb-checkbox-input-color",
};

export function createCSSVariablesDecorator<T extends Record<string, unknown> = Record<string, unknown>>(
  additionalMappings?: CSSVarMapping
): Decorator<T & Record<string, unknown>> {
  const fullMapping = { ...CSS_VAR_MAP, ...additionalMappings };

  function CSSVariablesDecorator(
    Story: React.ComponentType,
    context: StoryContext<T & Record<string, unknown>>
  ): React.ReactElement {
    // Storybook's Decorator type doesn't properly infer args type, so we safely extract it
    // Access args through a type-safe helper
    interface ContextWithArgs {
      args?: T & Record<string, unknown>;
    }
    const safeContext = context as unknown as ContextWithArgs;
    const args = (safeContext.args ?? {}) as Record<string, string | undefined>;

    const cssVarStyle: React.CSSProperties & Record<string, string | undefined> = {};

    Object.entries(fullMapping).forEach(([argKey, cssVar]) => {
      if (args[argKey] !== undefined) {
        cssVarStyle[cssVar] = args[argKey];
      }
    });

    return (
      <div style={cssVarStyle} className="w-[600px]">
        <Story />
      </div>
    );
  }

  CSSVariablesDecorator.displayName = "CSSVariablesDecorator";
  return CSSVariablesDecorator;
}

// ============================================================================
// Stateful Render Function Creator
// ============================================================================

export function createStatefulRender<
  TValue,
  TProps extends { value?: TValue; onChange?: (v: TValue) => void } & Record<string, unknown>,
>(Component: any): (args: TProps) => React.ReactElement {
  function StatefulRender(args: Readonly<TProps>): React.ReactElement {
    const [value, setValue] = useState<TValue | undefined>(args.value);

    useEffect(() => {
      setValue(args.value);
    }, [args.value]);

    return (
      <Component
        {...args}
        value={value}
        onChange={(v: TValue) => {
          setValue(v);
          args.onChange?.(v);
        }}
      />
    );
  }

  StatefulRender.displayName = "StatefulRender";
  return StatefulRender;
}

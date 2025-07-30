import { isValidCssSelector } from "@/app/lib/actionClass/actionClass";
import { zodResolver } from "@hookform/resolvers/zod";
import { TFnType } from "@tolgee/react";
import { useMemo } from "react";
import { z } from "zod";
import {
  TActionClass,
  TActionClassInput,
  TActionClassInputCode,
  ZActionClassInput,
} from "@formbricks/types/action-classes";

/**
 * Extract action class keys from code-type action classes
 */
export const useActionClassKeys = (actionClasses: TActionClass[]) => {
  return useMemo(() => {
    const codeActionClasses: TActionClassInputCode[] = actionClasses.filter(
      (actionClass) => actionClass.type === "code"
    ) as TActionClassInputCode[];

    return codeActionClasses
      .map((actionClass) => actionClass.key)
      .filter((key): key is string => key !== null);
  }, [actionClasses]);
};

/**
 * Validate action name uniqueness
 */
export const validateActionNameUniqueness = (
  data: TActionClassInput,
  actionClassNames: string[],
  ctx: z.RefinementCtx,
  t: TFnType
) => {
  if (data.name && actionClassNames.includes(data.name)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["name"],
      message: t("environments.actions.action_with_name_already_exists", { name: data.name }),
    });
  }
};

/**
 * Validate action key uniqueness for code actions
 */
export const validateActionKeyUniqueness = (
  data: TActionClassInput,
  actionClassKeys: string[],
  ctx: z.RefinementCtx,
  t: TFnType
) => {
  if (data.type === "code" && data.key && actionClassKeys.includes(data.key)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["key"],
      message: t("environments.actions.action_with_key_already_exists", { key: data.key }),
    });
  }
};

/**
 * Validate CSS selector for noCode click actions
 */
export const validateCssSelector = (data: TActionClassInput, ctx: z.RefinementCtx, t: TFnType) => {
  if (
    data.type === "noCode" &&
    data.noCodeConfig?.type === "click" &&
    data.noCodeConfig.elementSelector.cssSelector &&
    !isValidCssSelector(data.noCodeConfig.elementSelector.cssSelector)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["noCodeConfig", "elementSelector", "cssSelector"],
      message: t("environments.actions.invalid_css_selector"),
    });
  }
};

/**
 * Validate regex patterns in URL filters
 */
export const validateUrlFilterRegex = (data: TActionClassInput, ctx: z.RefinementCtx, t: TFnType) => {
  if (data.type === "noCode" && data.noCodeConfig?.urlFilters) {
    for (let i = 0; i < data.noCodeConfig.urlFilters.length; i++) {
      const urlFilter = data.noCodeConfig.urlFilters[i];
      if (urlFilter.rule === "matchesRegex") {
        try {
          new RegExp(urlFilter.value);
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["noCodeConfig", "urlFilters", i, "value"],
            message: t("environments.actions.invalid_regex"),
          });
        }
      }
    }
  }
};

/**
 * Create a zodResolver with comprehensive validation for action class forms
 */
export const createActionClassZodResolver = (
  actionClassNames: string[],
  actionClassKeys: string[],
  t: TFnType
) => {
  return zodResolver(
    ZActionClassInput.superRefine((data, ctx) => {
      validateActionNameUniqueness(data, actionClassNames, ctx, t);
      validateActionKeyUniqueness(data, actionClassKeys, ctx, t);
      validateCssSelector(data, ctx, t);
      validateUrlFilterRegex(data, ctx, t);
    })
  );
};

/**
 * Validate permissions for action class forms
 */
export const validatePermissions = (isReadOnly: boolean, t: TFnType) => {
  if (isReadOnly) {
    throw new Error(t("common.you_are_not_authorised_to_perform_this_action"));
  }
};

import { type TI18nString } from "@formbricks/types/i18n";
import {
  type TSurveyAddressElement,
  type TSurveyCTAElement,
  type TSurveyCalElement,
  type TSurveyConsentElement,
  type TSurveyContactInfoElement,
  type TSurveyDateElement,
  type TSurveyElement,
  TSurveyElementTypeEnum,
  type TSurveyFileUploadElement,
  type TSurveyMatrixElement,
  type TSurveyMultipleChoiceElement,
  type TSurveyNPSElement,
  type TSurveyOpenTextElement,
  type TSurveyPictureSelectionElement,
  type TSurveyRankingElement,
  type TSurveyRatingElement,
} from "@formbricks/types/surveys/elements";
import { type TConditionGroup, type TSingleCondition } from "@formbricks/types/surveys/logic";
import { type TSurvey, type TSurveyQuestion } from "@formbricks/types/surveys/types";
import {
  type ExportableEnding,
  type ExportableLogicRule,
  type ExportableQuestion,
  type ExportableQuestionDetail,
  type ExportableSection,
  type ExportableSurvey,
} from "./types";

const lang = "default";

function i18n(str: TI18nString | undefined): string {
  if (!str) return "";
  return str[lang] || str["default"] || "";
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    [TSurveyElementTypeEnum.OpenText]: "Open Text",
    [TSurveyElementTypeEnum.MultipleChoiceSingle]: "Multiple Choice (Single)",
    [TSurveyElementTypeEnum.MultipleChoiceMulti]: "Multiple Choice (Multi)",
    [TSurveyElementTypeEnum.NPS]: "Net Promoter Score (NPS)",
    [TSurveyElementTypeEnum.CTA]: "Call to Action",
    [TSurveyElementTypeEnum.Rating]: "Rating",
    [TSurveyElementTypeEnum.Consent]: "Consent",
    [TSurveyElementTypeEnum.PictureSelection]: "Picture Selection",
    [TSurveyElementTypeEnum.Date]: "Date",
    [TSurveyElementTypeEnum.FileUpload]: "File Upload",
    [TSurveyElementTypeEnum.Cal]: "Calendar Scheduling",
    [TSurveyElementTypeEnum.Matrix]: "Matrix / Likert",
    [TSurveyElementTypeEnum.Address]: "Address",
    [TSurveyElementTypeEnum.Ranking]: "Ranking",
    [TSurveyElementTypeEnum.ContactInfo]: "Contact Info",
  };
  return labels[type] || type;
}

function getElementDetails(el: TSurveyElement): ExportableQuestionDetail[] {
  const details: ExportableQuestionDetail[] = [];

  switch (el.type) {
    case TSurveyElementTypeEnum.OpenText: {
      const q = el as TSurveyOpenTextElement;
      if (q.inputType && q.inputType !== "text") {
        details.push({ label: "Input Type", value: q.inputType });
      }
      if (q.longAnswer) {
        details.push({ label: "Format", value: "Long answer (multi-line)" });
      }
      if (q.placeholder) {
        details.push({ label: "Placeholder", value: i18n(q.placeholder) });
      }
      if (q.charLimit?.enabled) {
        const parts: string[] = [];
        if (q.charLimit.min !== undefined) parts.push(`Min: ${q.charLimit.min}`);
        if (q.charLimit.max !== undefined) parts.push(`Max: ${q.charLimit.max}`);
        details.push({ label: "Character Limit", value: parts.join(", ") });
      }
      break;
    }

    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti: {
      const q = el as TSurveyMultipleChoiceElement;
      const choiceLabels = q.choices.map((c) => i18n(c.label));
      details.push({ label: "Choices", value: choiceLabels.join(", "), items: choiceLabels });
      if (q.shuffleOption && q.shuffleOption !== "none") {
        details.push({
          label: "Shuffle",
          value: q.shuffleOption === "all" ? "All choices" : "All except last",
        });
      }
      if (q.displayType === "dropdown") {
        details.push({ label: "Display", value: "Dropdown" });
      }
      break;
    }

    case TSurveyElementTypeEnum.NPS: {
      const q = el as TSurveyNPSElement;
      details.push({ label: "Scale", value: "0 - 10" });
      if (q.lowerLabel) details.push({ label: "Lower Label", value: i18n(q.lowerLabel) });
      if (q.upperLabel) details.push({ label: "Upper Label", value: i18n(q.upperLabel) });
      break;
    }

    case TSurveyElementTypeEnum.Rating: {
      const q = el as TSurveyRatingElement;
      const scaleNames: Record<string, string> = { number: "Number", smiley: "Smiley", star: "Star" };
      details.push({ label: "Scale", value: `${scaleNames[q.scale] || q.scale} (1-${q.range})` });
      if (q.lowerLabel) details.push({ label: "Lower Label", value: i18n(q.lowerLabel) });
      if (q.upperLabel) details.push({ label: "Upper Label", value: i18n(q.upperLabel) });
      break;
    }

    case TSurveyElementTypeEnum.CTA: {
      const q = el as TSurveyCTAElement;
      if (q.ctaButtonLabel) details.push({ label: "Button Label", value: i18n(q.ctaButtonLabel) });
      if (q.buttonExternal && q.buttonUrl) {
        details.push({ label: "Button URL", value: q.buttonUrl });
      }
      break;
    }

    case TSurveyElementTypeEnum.Consent: {
      const q = el as TSurveyConsentElement;
      details.push({ label: "Consent Text", value: i18n(q.label) });
      break;
    }

    case TSurveyElementTypeEnum.PictureSelection: {
      const q = el as TSurveyPictureSelectionElement;
      details.push({ label: "Number of Images", value: String(q.choices.length) });
      details.push({ label: "Allow Multiple", value: q.allowMulti ? "Yes" : "No" });
      break;
    }

    case TSurveyElementTypeEnum.Date: {
      const q = el as TSurveyDateElement;
      const formatLabels: Record<string, string> = {
        "M-d-y": "Month-Day-Year",
        "d-M-y": "Day-Month-Year",
        "y-M-d": "Year-Month-Day",
      };
      details.push({ label: "Format", value: formatLabels[q.format] || q.format });
      if (q.dateKind === "monthYear") {
        details.push({ label: "Date Kind", value: "Month & Year only" });
      }
      break;
    }

    case TSurveyElementTypeEnum.FileUpload: {
      const q = el as TSurveyFileUploadElement;
      details.push({ label: "Multiple Files", value: q.allowMultipleFiles ? "Yes" : "No" });
      if (q.maxSizeInMB) details.push({ label: "Max Size", value: `${q.maxSizeInMB} MB` });
      if (q.allowedFileExtensions?.length) {
        details.push({ label: "Allowed Extensions", value: q.allowedFileExtensions.join(", ") });
      }
      break;
    }

    case TSurveyElementTypeEnum.Cal: {
      const q = el as TSurveyCalElement;
      details.push({ label: "Cal.com User", value: q.calUserName });
      if (q.calHost) details.push({ label: "Cal Host", value: q.calHost });
      break;
    }

    case TSurveyElementTypeEnum.Matrix: {
      const q = el as TSurveyMatrixElement;
      const rowLabels = q.rows.map((r) => i18n(r.label));
      const colLabels = q.columns.map((c) => i18n(c.label));
      details.push({ label: "Rows", value: rowLabels.join(", "), items: rowLabels });
      details.push({ label: "Columns", value: colLabels.join(", "), items: colLabels });
      break;
    }

    case TSurveyElementTypeEnum.Address: {
      const q = el as TSurveyAddressElement;
      const fields = [
        { key: "addressLine1", cfg: q.addressLine1 },
        { key: "addressLine2", cfg: q.addressLine2 },
        { key: "city", cfg: q.city },
        { key: "state", cfg: q.state },
        { key: "zip", cfg: q.zip },
        { key: "country", cfg: q.country },
      ];
      const shown = fields.filter((f) => f.cfg.show);
      const required = shown.filter((f) => f.cfg.required).map((f) => f.key);
      details.push({
        label: "Fields Shown",
        value: shown.map((f) => f.key).join(", "),
        items: shown.map((f) => `${f.key}${f.cfg.required ? " *" : ""}`),
      });
      if (required.length > 0) {
        details.push({ label: "Required Sub-fields", value: required.join(", ") });
      }
      break;
    }

    case TSurveyElementTypeEnum.ContactInfo: {
      const q = el as TSurveyContactInfoElement;
      const fields = [
        { key: "firstName", cfg: q.firstName },
        { key: "lastName", cfg: q.lastName },
        { key: "email", cfg: q.email },
        { key: "phone", cfg: q.phone },
        { key: "company", cfg: q.company },
      ];
      const shown = fields.filter((f) => f.cfg.show);
      const required = shown.filter((f) => f.cfg.required).map((f) => f.key);
      details.push({
        label: "Fields Shown",
        value: shown.map((f) => f.key).join(", "),
        items: shown.map((f) => `${f.key}${f.cfg.required ? " *" : ""}`),
      });
      if (required.length > 0) {
        details.push({ label: "Required Sub-fields", value: required.join(", ") });
      }
      break;
    }

    case TSurveyElementTypeEnum.Ranking: {
      const q = el as TSurveyRankingElement;
      const choiceLabels = q.choices.map((c) => i18n(c.label));
      details.push({ label: "Items to Rank", value: choiceLabels.join(", "), items: choiceLabels });
      break;
    }
  }

  return details;
}

function operatorToString(op: string): string {
  const map: Record<string, string> = {
    equals: "equals",
    doesNotEqual: "does not equal",
    contains: "contains",
    doesNotContain: "does not contain",
    startsWith: "starts with",
    doesNotStartWith: "does not start with",
    endsWith: "ends with",
    doesNotEndWith: "does not end with",
    isSubmitted: "is submitted",
    isSkipped: "is skipped",
    isGreaterThan: "is greater than",
    isLessThan: "is less than",
    isGreaterThanOrEqual: "is greater than or equal to",
    isLessThanOrEqual: "is less than or equal to",
    equalsOneOf: "equals one of",
    includesAllOf: "includes all of",
    includesOneOf: "includes one of",
    doesNotIncludeOneOf: "does not include one of",
    doesNotIncludeAllOf: "does not include all of",
    isClicked: "is clicked",
    isNotClicked: "is not clicked",
    isAccepted: "is accepted",
    isBefore: "is before",
    isAfter: "is after",
    isBooked: "is booked",
    isPartiallySubmitted: "is partially submitted",
    isCompletelySubmitted: "is completely submitted",
    isSet: "is set",
    isNotSet: "is not set",
    isEmpty: "is empty",
    isNotEmpty: "is not empty",
    isAnyOf: "is any of",
  };
  return map[op] || op;
}

function resolveOperandLabel(
  operand: { type: string; value: string; meta?: Record<string, string> },
  survey: TSurvey
): string {
  if (operand.type === "element" || operand.type === "question") {
    // Find the element/question headline by ID
    const id = operand.value;
    for (const block of survey.blocks) {
      for (const el of block.elements) {
        if (el.id === id) return `"${i18n(el.headline)}"`;
      }
    }
    for (const q of survey.questions) {
      if (q.id === id) return `"${i18n(q.headline)}"`;
    }
    return `[${id}]`;
  }
  if (operand.type === "variable") {
    const v = survey.variables.find((vr) => vr.id === operand.value);
    return v ? `variable "${v.name}"` : `[var:${operand.value}]`;
  }
  if (operand.type === "hiddenField") {
    return `hidden field "${operand.value}"`;
  }
  return String(operand.value);
}

function isConditionGroup(obj: unknown): obj is TConditionGroup {
  return typeof obj === "object" && obj !== null && "connector" in obj && "conditions" in obj;
}

function conditionToString(cond: TSingleCondition | TConditionGroup, survey: TSurvey): string {
  if (isConditionGroup(cond)) {
    const parts = cond.conditions.map((c) =>
      conditionToString(c as TSingleCondition | TConditionGroup, survey)
    );
    const joined = parts.join(` ${cond.connector.toUpperCase()} `);
    return parts.length > 1 ? `(${joined})` : joined;
  }

  // Single condition
  const sc = cond as TSingleCondition;
  const left = resolveOperandLabel(sc.leftOperand, survey);
  const op = operatorToString(sc.operator);
  if (!sc.rightOperand) {
    return `${left} ${op}`;
  }
  let right: string;
  if (sc.rightOperand.type === "static") {
    const val = sc.rightOperand.value;
    right = Array.isArray(val) ? `[${val.join(", ")}]` : `"${val}"`;
  } else {
    right = resolveOperandLabel(sc.rightOperand as { type: string; value: string }, survey);
  }
  return `${left} ${op} ${right}`;
}

function blockActionToString(
  action: { objective: string; target?: string; variableId?: string; externalDataSourceId?: string },
  survey: TSurvey
): string {
  switch (action.objective) {
    case "jumpToBlock": {
      const block = survey.blocks.find((b) => b.id === action.target);
      return block ? `Jump to "${block.name}"` : `Jump to [${action.target}]`;
    }
    case "jumpToQuestion": {
      // Legacy
      for (const q of survey.questions) {
        if (q.id === action.target) return `Jump to "${i18n(q.headline)}"`;
      }
      return `Jump to [${action.target}]`;
    }
    case "requireAnswer": {
      // Find element headline
      for (const block of survey.blocks) {
        for (const el of block.elements) {
          if (el.id === action.target) return `Require answer for "${i18n(el.headline)}"`;
        }
      }
      for (const q of survey.questions) {
        if (q.id === action.target) return `Require answer for "${i18n(q.headline)}"`;
      }
      return `Require answer for [${action.target}]`;
    }
    case "calculate": {
      const v = survey.variables.find((vr) => vr.id === action.variableId);
      return v ? `Calculate variable "${v.name}"` : `Calculate [${action.variableId}]`;
    }
    case "callExternalAPI":
      return "Call external API";
    default:
      return action.objective;
  }
}

function logicRulesToExportable(
  logicArray: Array<{ conditions: TConditionGroup; actions: Array<Record<string, unknown>> }>,
  survey: TSurvey
): ExportableLogicRule[] {
  return logicArray.map((rule) => {
    const condStr = conditionToString(rule.conditions, survey);
    const actionStrs = rule.actions.map((a) =>
      blockActionToString(a as Parameters<typeof blockActionToString>[0], survey)
    );
    return { summary: `If ${condStr} -> ${actionStrs.join("; ")}` };
  });
}

function elementToExportableQuestion(el: TSurveyElement, index: number): ExportableQuestion {
  return {
    index,
    id: el.id,
    type: getTypeLabel(el.type),
    headline: i18n(el.headline),
    subheader: el.subheader ? i18n(el.subheader) : undefined,
    required: el.required,
    details: getElementDetails(el),
  };
}

function questionToExportableQuestion(
  q: TSurveyQuestion,
  index: number,
  survey: TSurvey
): ExportableQuestion {
  // Legacy questions have the same fields as elements plus logic/buttonLabel
  const exportable: ExportableQuestion = {
    index,
    id: q.id,
    type: getTypeLabel(q.type),
    headline: i18n(q.headline),
    subheader: q.subheader ? i18n(q.subheader) : undefined,
    required: q.required,
    details: getElementDetails(q as unknown as TSurveyElement),
  };

  if (q.logic && q.logic.length > 0) {
    exportable.logic = logicRulesToExportable(
      q.logic as Array<{ conditions: TConditionGroup; actions: Array<Record<string, unknown>> }>,
      survey
    );
  }

  return exportable;
}

export function surveyToExportable(survey: TSurvey): ExportableSurvey {
  const sections: ExportableSection[] = [];
  let questionIndex = 1;

  const hasBlocks = survey.blocks.length > 0 && survey.blocks.some((b) => b.elements.length > 0);

  if (hasBlocks) {
    for (const block of survey.blocks) {
      const questions: ExportableQuestion[] = [];
      for (const el of block.elements) {
        questions.push(elementToExportableQuestion(el, questionIndex));
        questionIndex++;
      }
      const section: ExportableSection = {
        name: block.name,
        questions,
        buttonLabel: block.buttonLabel ? i18n(block.buttonLabel) : undefined,
        backButtonLabel: block.backButtonLabel ? i18n(block.backButtonLabel) : undefined,
      };
      if (block.logic && block.logic.length > 0) {
        section.logic = logicRulesToExportable(
          block.logic as Array<{ conditions: TConditionGroup; actions: Array<Record<string, unknown>> }>,
          survey
        );
      }
      sections.push(section);
    }
  } else if (survey.questions.length > 0) {
    const questions: ExportableQuestion[] = [];
    for (const q of survey.questions) {
      questions.push(questionToExportableQuestion(q, questionIndex, survey));
      questionIndex++;
    }
    sections.push({ name: "Questions", questions });
  }

  const endings: ExportableEnding[] = survey.endings.map((ending) => {
    if (ending.type === "endScreen") {
      return {
        type: "endScreen" as const,
        headline: ending.headline ? i18n(ending.headline) : undefined,
        subheader: ending.subheader ? i18n(ending.subheader) : undefined,
        buttonLabel: ending.buttonLabel ? i18n(ending.buttonLabel) : undefined,
      };
    }
    return {
      type: "redirectToUrl" as const,
      redirectUrl: ending.url || undefined,
      headline: ending.label || undefined,
    };
  });

  const hiddenFields: string[] = [];
  if (survey.hiddenFields.enabled && survey.hiddenFields.fieldIds) {
    hiddenFields.push(...survey.hiddenFields.fieldIds);
  }

  const variables = survey.variables.map((v) => ({
    name: v.name,
    type: v.type,
    value: v.value,
  }));

  let welcomeCard: ExportableSurvey["welcomeCard"];
  if (survey.welcomeCard.enabled) {
    welcomeCard = {
      headline: survey.welcomeCard.headline ? i18n(survey.welcomeCard.headline) : undefined,
      subheader: survey.welcomeCard.subheader ? i18n(survey.welcomeCard.subheader) : undefined,
      buttonLabel: survey.welcomeCard.buttonLabel ? i18n(survey.welcomeCard.buttonLabel) : undefined,
    };
  }

  return {
    name: survey.name,
    createdAt: survey.createdAt,
    status: survey.status,
    type: survey.type,
    welcomeCard,
    sections,
    endings,
    hiddenFields,
    variables,
  };
}

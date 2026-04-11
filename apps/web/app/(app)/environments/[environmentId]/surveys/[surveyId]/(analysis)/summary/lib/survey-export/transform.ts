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
  type ExportableSection,
  type ExportableSurvey,
} from "./types";

const lang = "default";

function stripHtml(html: string): string {
  // Replace <br>, <br/>, </p><p...> with newlines, then strip all remaining tags
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function i18n(str: TI18nString | undefined): string {
  if (!str) return "";
  const raw = str[lang] || str["default"] || "";
  return stripHtml(raw);
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    [TSurveyElementTypeEnum.OpenText]: "Open Text",
    [TSurveyElementTypeEnum.MultipleChoiceSingle]: "Single Select",
    [TSurveyElementTypeEnum.MultipleChoiceMulti]: "Multi Select",
    [TSurveyElementTypeEnum.NPS]: "NPS",
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

function extractRichData(el: TSurveyElement, q: ExportableQuestion): void {
  switch (el.type) {
    case TSurveyElementTypeEnum.OpenText: {
      const ot = el as TSurveyOpenTextElement;
      q.inputConfig = {
        type: ot.inputType || "text",
        longAnswer: ot.longAnswer || false,
        placeholder: ot.placeholder ? i18n(ot.placeholder) : undefined,
      };
      if (ot.charLimit?.enabled) {
        const parts: string[] = [];
        if (ot.charLimit.min !== undefined) parts.push(`Min: ${ot.charLimit.min}`);
        if (ot.charLimit.max !== undefined) parts.push(`Max: ${ot.charLimit.max}`);
        q.details.push({ label: "Character Limit", value: parts.join(", ") });
      }
      break;
    }

    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti: {
      const mc = el as TSurveyMultipleChoiceElement;
      q.choices = mc.choices.map((c) => ({ label: i18n(c.label) }));
      if (mc.otherOptionPlaceholder) {
        q.choices.push({ label: i18n(mc.otherOptionPlaceholder) || "Other", isOther: true });
      }
      if (mc.shuffleOption && mc.shuffleOption !== "none") {
        q.details.push({
          label: "Shuffle",
          value: mc.shuffleOption === "all" ? "All choices" : "All except last",
        });
      }
      if (mc.displayType === "dropdown") {
        q.details.push({ label: "Display", value: "Dropdown" });
      }
      break;
    }

    case TSurveyElementTypeEnum.NPS: {
      const nps = el as TSurveyNPSElement;
      q.npsScale = {
        lowerLabel: nps.lowerLabel ? i18n(nps.lowerLabel) : undefined,
        upperLabel: nps.upperLabel ? i18n(nps.upperLabel) : undefined,
      };
      break;
    }

    case TSurveyElementTypeEnum.Rating: {
      const rt = el as TSurveyRatingElement;
      q.ratingScale = {
        style: rt.scale as "number" | "smiley" | "star",
        range: rt.range,
        lowerLabel: rt.lowerLabel ? i18n(rt.lowerLabel) : undefined,
        upperLabel: rt.upperLabel ? i18n(rt.upperLabel) : undefined,
      };
      break;
    }

    case TSurveyElementTypeEnum.CTA: {
      const cta = el as TSurveyCTAElement;
      if (cta.ctaButtonLabel) q.details.push({ label: "Button Label", value: i18n(cta.ctaButtonLabel) });
      if (cta.buttonExternal && cta.buttonUrl) {
        q.details.push({ label: "Button URL", value: cta.buttonUrl });
      }
      break;
    }

    case TSurveyElementTypeEnum.Consent: {
      const con = el as TSurveyConsentElement;
      q.consentLabel = i18n(con.label);
      break;
    }

    case TSurveyElementTypeEnum.PictureSelection: {
      const ps = el as TSurveyPictureSelectionElement;
      q.details.push({ label: "Images", value: `${ps.choices.length} images` });
      q.details.push({ label: "Allow Multiple", value: ps.allowMulti ? "Yes" : "No" });
      break;
    }

    case TSurveyElementTypeEnum.Date: {
      const dt = el as TSurveyDateElement;
      const formatLabels: Record<string, string> = {
        "M-d-y": "MM / DD / YYYY",
        "d-M-y": "DD / MM / YYYY",
        "y-M-d": "YYYY / MM / DD",
      };
      q.details.push({ label: "Format", value: formatLabels[dt.format] || dt.format });
      if (dt.dateKind === "monthYear") {
        q.details.push({ label: "Date Kind", value: "Month & Year only" });
      }
      break;
    }

    case TSurveyElementTypeEnum.FileUpload: {
      const fu = el as TSurveyFileUploadElement;
      q.details.push({ label: "Multiple Files", value: fu.allowMultipleFiles ? "Yes" : "No" });
      if (fu.maxSizeInMB) q.details.push({ label: "Max Size", value: `${fu.maxSizeInMB} MB` });
      if (fu.allowedFileExtensions?.length) {
        q.details.push({ label: "Allowed Extensions", value: fu.allowedFileExtensions.join(", ") });
      }
      break;
    }

    case TSurveyElementTypeEnum.Cal: {
      const cal = el as TSurveyCalElement;
      q.details.push({ label: "Cal.com User", value: cal.calUserName });
      if (cal.calHost) q.details.push({ label: "Cal Host", value: cal.calHost });
      break;
    }

    case TSurveyElementTypeEnum.Matrix: {
      const mx = el as TSurveyMatrixElement;
      q.matrix = {
        rows: mx.rows.map((r) => i18n(r.label)),
        columns: mx.columns.map((c) => i18n(c.label)),
      };
      break;
    }

    case TSurveyElementTypeEnum.Address: {
      const addr = el as TSurveyAddressElement;
      const addrFields = [
        { key: "Address Line 1", cfg: addr.addressLine1 },
        { key: "Address Line 2", cfg: addr.addressLine2 },
        { key: "City", cfg: addr.city },
        { key: "State", cfg: addr.state },
        { key: "ZIP", cfg: addr.zip },
        { key: "Country", cfg: addr.country },
      ];
      q.addressFields = addrFields
        .filter((f) => f.cfg.show)
        .map((f) => ({
          name: f.key,
          required: f.cfg.required,
          placeholder: i18n(f.cfg.placeholder) || undefined,
        }));
      break;
    }

    case TSurveyElementTypeEnum.ContactInfo: {
      const ci = el as TSurveyContactInfoElement;
      const ciFields = [
        { key: "First Name", cfg: ci.firstName },
        { key: "Last Name", cfg: ci.lastName },
        { key: "Email", cfg: ci.email },
        { key: "Phone", cfg: ci.phone },
        { key: "Company", cfg: ci.company },
      ];
      // Add custom fields
      const customCiFields = ((ci as any).customFields ?? []).map(
        (cf: { label: string; show: boolean; required: boolean; placeholder?: any }) => ({
          key: cf.label,
          cfg: { show: cf.show, required: cf.required, placeholder: cf.placeholder },
        })
      );
      q.contactFields = [...ciFields, ...customCiFields]
        .filter((f) => f.cfg.show)
        .map((f) => ({
          name: f.key,
          required: f.cfg.required,
          placeholder: i18n(f.cfg.placeholder) || undefined,
        }));
      break;
    }

    case TSurveyElementTypeEnum.Ranking: {
      const rk = el as TSurveyRankingElement;
      q.choices = rk.choices.map((c) => ({ label: i18n(c.label) }));
      break;
    }
  }
}

// --- Logic helpers (unchanged) ---

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

function findChoiceLabel(choiceId: string, elementId: string, survey: TSurvey): string | null {
  // Look through blocks
  for (const block of survey.blocks) {
    for (const el of block.elements) {
      if (el.id !== elementId) continue;
      if ("choices" in el && Array.isArray(el.choices)) {
        const choice = el.choices.find((c: { id: string }) => c.id === choiceId);
        if (choice && "label" in choice) return i18n(choice.label as TI18nString);
      }
    }
  }
  // Look through legacy questions
  for (const q of survey.questions) {
    if (q.id !== elementId) continue;
    if ("choices" in q && Array.isArray(q.choices)) {
      const choice = q.choices.find((c: { id: string }) => c.id === choiceId);
      if (choice && "label" in choice) return i18n(choice.label as TI18nString);
    }
  }
  return null;
}

function resolveStaticValue(
  val: string | number | string[],
  leftElementId: string,
  survey: TSurvey
): string {
  if (Array.isArray(val)) {
    const resolved = val.map((v) => {
      const label = findChoiceLabel(v, leftElementId, survey);
      return label || v;
    });
    return `[${resolved.join(", ")}]`;
  }
  if (typeof val === "string") {
    const label = findChoiceLabel(val, leftElementId, survey);
    if (label) return `"${label}"`;
  }
  return `"${val}"`;
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

  const sc = cond as TSingleCondition;
  const left = resolveOperandLabel(sc.leftOperand, survey);
  const op = operatorToString(sc.operator);
  if (!sc.rightOperand) {
    return `${left} ${op}`;
  }
  let right: string;
  if (sc.rightOperand.type === "static") {
    const leftElementId = sc.leftOperand.value;
    right = resolveStaticValue(sc.rightOperand.value, leftElementId, survey);
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
      for (const q of survey.questions) {
        if (q.id === action.target) return `Jump to "${i18n(q.headline)}"`;
      }
      return `Jump to [${action.target}]`;
    }
    case "requireAnswer": {
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

// --- Build exportable questions ---

function elementToExportableQuestion(el: TSurveyElement, index: number): ExportableQuestion {
  const q: ExportableQuestion = {
    index,
    id: el.id,
    type: getTypeLabel(el.type),
    elementType: el.type,
    headline: i18n(el.headline),
    subheader: el.subheader ? i18n(el.subheader) : undefined,
    required: el.required,
    details: [],
  };
  extractRichData(el, q);
  return q;
}

function questionToExportableQuestion(
  q: TSurveyQuestion,
  index: number,
  survey: TSurvey
): ExportableQuestion {
  const exportable: ExportableQuestion = {
    index,
    id: q.id,
    type: getTypeLabel(q.type),
    elementType: q.type,
    headline: i18n(q.headline),
    subheader: q.subheader ? i18n(q.subheader) : undefined,
    required: q.required,
    details: [],
  };
  extractRichData(q as unknown as TSurveyElement, exportable);

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

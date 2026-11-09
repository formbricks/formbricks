import { isPlainObject } from "@/app/api/v3/surveys/guards";
import { isDefaultEndingCardButtonLink } from "@/lib/survey/default-ending-card";
import type { TDefaultEndingText } from "@/modules/survey/import/core/default-ending";
import type { TSurveyImportPipelineIssue } from "@/modules/survey/import/core/report";

/**
 * The third of a Formbricks file import's validation tiers (ENG-3411, ENG-6850): what the survey
 * carries that the target workspace cannot hold is removed, one report warning each, instead of
 * failing the import.
 *
 * - **Custom CSS** never travels with an import: it is styling, which a Formbricks file leaves out.
 * - **External URLs**, when the organization's plan does not allow them: a redirect ending becomes the
 *   editor's default ending under the same id (so logic that jumps to it still lands), an ending's
 *   button loses its link, and a call-to-action its external button.
 * - **Targeting**, when the plan has no contact targeting, goes whole. Otherwise only the filters that
 *   point into the workspace the file came from go: segment filters (a segment id) and survey-interaction
 *   filters on specific surveys (survey ids). The rest — attributes, devices, people — are carried as
 *   they are, with the attribute keys they name matched or created by the resolver.
 *
 * Pure: the entitlements and the default ending's texts are looked up by the caller.
 */

export interface TFormbricksFileFitContext {
  allowExternalUrls: boolean;
  allowTargeting: boolean;
  /**
   * The editor's default ending in each of the survey's languages, keyed by language code, for a
   * redirect ending the plan does not allow. `null` where Formbricks has no strings for the language.
   */
  defaultEndingTexts: Readonly<Record<string, TDefaultEndingText | null>>;
}

const arrayOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** The survey's language codes, default first, as its texts are keyed. */
export const getFormbricksFileSurveyLanguageCodes = (survey: Record<string, unknown>): string[] => {
  const defaultLanguage = typeof survey.defaultLanguage === "string" ? survey.defaultLanguage : null;
  const codes = arrayOf(survey.languages)
    .filter(isPlainObject)
    .map((language) => language.code)
    .filter((code): code is string => typeof code === "string");
  const ordered = defaultLanguage
    ? [defaultLanguage, ...codes.filter((code) => code !== defaultLanguage)]
    : codes;
  return [...new Set(ordered)];
};

/** A redirect ending as the editor's default ending, under the same id, in every language. */
const toDefaultEnding = (
  id: unknown,
  languageCodes: readonly string[],
  texts: TFormbricksFileFitContext["defaultEndingTexts"]
): Record<string, unknown> => {
  const fallback = texts[languageCodes[0]] ?? null;
  const headline: Record<string, string> = {};
  const subheader: Record<string, string> = {};
  for (const code of languageCodes) {
    const text = texts[code] ?? fallback;
    if (!text) continue;
    headline[code] = text.headline;
    subheader[code] = text.subheader;
  }
  return { id, type: "endScreen", headline, subheader };
};

const removeExternalUrls = (
  survey: Record<string, unknown>,
  defaultEndingTexts: TFormbricksFileFitContext["defaultEndingTexts"],
  issues: TSurveyImportPipelineIssue[]
): void => {
  const languageCodes = getFormbricksFileSurveyLanguageCodes(survey);

  if (Array.isArray(survey.endings)) {
    survey.endings = survey.endings.map((ending: unknown) => {
      if (!isPlainObject(ending)) return ending;
      if (ending.type === "redirectToUrl") {
        issues.push({ code: "external_url_removed", severity: "warning", params: { subject: "ending" } });
        return toDefaultEnding(ending.id, languageCodes, defaultEndingTexts);
      }
      const buttonLink = typeof ending.buttonLink === "string" ? ending.buttonLink : undefined;
      if (ending.type === "endScreen" && buttonLink && !isDefaultEndingCardButtonLink(buttonLink)) {
        issues.push({ code: "external_url_removed", severity: "warning", params: { subject: "ending" } });
        const { buttonLink: _buttonLink, buttonLabel: _buttonLabel, ...rest } = ending;
        return rest;
      }
      return ending;
    });
  }

  const unlinkedCtas = new Set<string>();
  for (const block of arrayOf(survey.blocks).filter(isPlainObject)) {
    if (!Array.isArray(block.elements)) continue;
    block.elements = block.elements.map((element: unknown) => {
      if (!isPlainObject(element) || element.type !== "cta" || element.buttonExternal !== true) {
        return element;
      }
      if (typeof element.id === "string") unlinkedCtas.add(element.id);
      issues.push({
        code: "external_url_removed",
        severity: "warning",
        ...(typeof element.id === "string" ? { questionTag: element.id } : {}),
      });
      const { buttonUrl: _buttonUrl, ctaButtonLabel: _ctaButtonLabel, ...rest } = element;
      return { ...rest, buttonExternal: false };
    });
  }

  // Whether a CTA was clicked can only be asked of one with an external button, so a rule asking it
  // of a CTA that just lost its button goes too: the survey would not save with it.
  if (unlinkedCtas.size > 0) removeLogicOn(survey, unlinkedCtas, issues);
};

/** Whether a condition tree reads one of `elementIds`, on either side of any condition in it. */
const conditionsRead = (node: unknown, elementIds: ReadonlySet<string>): boolean => {
  if (!isPlainObject(node)) return false;
  if (Array.isArray(node.conditions))
    return node.conditions.some((child) => conditionsRead(child, elementIds));
  return [node.leftOperand, node.rightOperand].some(
    (operand) =>
      isPlainObject(operand) &&
      operand.type === "element" &&
      typeof operand.value === "string" &&
      elementIds.has(operand.value)
  );
};

/** The logic rules whose conditions read one of `elementIds`, removed with a warning each. */
const removeLogicOn = (
  survey: Record<string, unknown>,
  elementIds: ReadonlySet<string>,
  issues: TSurveyImportPipelineIssue[]
): void => {
  for (const block of arrayOf(survey.blocks).filter(isPlainObject)) {
    if (!Array.isArray(block.logic)) continue;
    block.logic = block.logic.filter((rule: unknown) => {
      if (!isPlainObject(rule) || !conditionsRead(rule.conditions, elementIds)) return true;
      issues.push({
        code: "logic_not_imported",
        severity: "warning",
        ...(typeof block.name === "string" ? { params: { block: block.name } } : {}),
      });
      return false;
    });
  }
};

/** A leaf that points into the workspace the file came from: a segment, or specific surveys. */
const isSourceWorkspaceFilter = (resource: Record<string, unknown>): boolean => {
  const root = isPlainObject(resource.root) ? resource.root : {};
  if (root.type === "segment") return true;
  const value = isPlainObject(resource.value) ? resource.value : {};
  return root.type === "surveyInteraction" && value.surveyScope === "specific";
};

/**
 * The filter tree without the leaves `isSourceWorkspaceFilter` names. A group left empty goes too, and
 * whatever comes first in a list loses its connector, as the first filter of every list has none.
 */
const pruneFilters = (filters: readonly unknown[], removed: { count: number }): unknown[] => {
  const kept: Record<string, unknown>[] = [];
  for (const node of filters) {
    if (!isPlainObject(node)) continue;
    const { resource } = node;
    if (Array.isArray(resource)) {
      const group = pruneFilters(resource, removed);
      if (group.length > 0) kept.push({ ...node, resource: group });
      continue;
    }
    if (isPlainObject(resource) && isSourceWorkspaceFilter(resource)) {
      removed.count += 1;
      continue;
    }
    kept.push(node);
  }
  if (kept.length > 0 && kept[0].connector !== null) kept[0] = { ...kept[0], connector: null };
  return kept;
};

const fitTargeting = (
  survey: Record<string, unknown>,
  allowTargeting: boolean,
  issues: TSurveyImportPipelineIssue[]
): void => {
  if (!isPlainObject(survey.targeting)) return;
  const filters = arrayOf(survey.targeting.filters);
  if (filters.length === 0) return;

  if (!allowTargeting) {
    delete survey.targeting;
    issues.push({ code: "targeting_removed", severity: "warning" });
    return;
  }

  const removed = { count: 0 };
  const pruned = pruneFilters(filters, removed);
  if (removed.count === 0) return;
  survey.targeting = { ...survey.targeting, filters: pruned };
  issues.push({ code: "targeting_filter_removed", severity: "warning", params: { count: removed.count } });
};

/**
 * The survey with what the workspace cannot hold removed, and a warning for each removal. The input is
 * left as it is.
 */
export const fitFormbricksFileSurvey = (
  input: Record<string, unknown>,
  { allowExternalUrls, allowTargeting, defaultEndingTexts }: TFormbricksFileFitContext
): { survey: Record<string, unknown>; issues: TSurveyImportPipelineIssue[] } => {
  const survey = structuredClone(input);
  const issues: TSurveyImportPipelineIssue[] = [];

  if ("customCss" in survey) {
    const css = survey.customCss;
    // `null`, or both appearances empty, is no CSS at all: nothing to warn about.
    const hasCss =
      isPlainObject(css) &&
      [css.light, css.dark].some((source) => typeof source === "string" && source !== "");
    delete survey.customCss;
    if (hasCss) issues.push({ code: "custom_css_removed", severity: "warning" });
  }
  if (!allowExternalUrls) removeExternalUrls(survey, defaultEndingTexts, issues);
  fitTargeting(survey, allowTargeting, issues);

  return { survey, issues };
};

/** Whether the survey has a redirect ending, the one removal that needs the default ending's texts. */
export const hasFormbricksFileRedirectEnding = (survey: Record<string, unknown>): boolean =>
  arrayOf(survey.endings).some((ending) => isPlainObject(ending) && ending.type === "redirectToUrl");

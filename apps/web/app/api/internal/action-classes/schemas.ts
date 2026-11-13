import { z } from "zod";
import { ZActionClassInput, ZActionClassNoCodeConfig } from "@formbricks/types/action-classes";
import { ZId } from "@formbricks/types/common";
import { ATTRIBUTE_DESCRIPTION_MAX_LENGTH } from "@/app/api/internal/contact-attribute-keys/schemas";
import { strictDeep } from "@/app/api/internal/lib/strict-schema";
import { V3_NAME_MAX_LENGTH } from "@/app/api/v3/charts/lib/schemas";
import { MAX_CALLBACK_URL_LENGTH } from "@/lib/utils/url";

/**
 * Caps on what an action write carries (CODING_STANDARDS.md "Input Limits"), applied here rather than in
 * the shared `ZActionClassInput`, which the public APIs also parse. Far above what the forms produce.
 */
/** A code action's key, as the SDK's `track()` call names it. */
export const ACTION_CLASS_KEY_MAX_LENGTH = 255;
/** A click action's CSS selector or inner HTML. */
export const ACTION_CLASS_ELEMENT_SELECTOR_MAX_LENGTH = 5000;
/** Page-URL filters on one no-code action. */
export const ACTION_CLASS_URL_FILTERS_MAX = 100;

export const ZActionClassParams = z.object({ actionClassId: ZId }).strict();

const [ZCodeInput, ZNoCodeInput] = ZActionClassInput.options;

/** The workspace a new action is created in: the query's, authorized, never the body's. */
export const ZActionClassWorkspaceQuery = z.object({ workspaceId: ZId }).strict();

const [ZClickConfig, ZPageViewConfig, ZExitIntentConfig, ZScrollConfig, ZPageDwellConfig] =
  ZActionClassNoCodeConfig.options;

/** One page-URL filter: the shared rule check, with its value capped at the longest URL the app accepts. */
const ZUrlFilterInput = ZClickConfig.shape.urlFilters.element.safeExtend({
  value: ZClickConfig.shape.urlFilters.element.shape.value.max(MAX_CALLBACK_URL_LENGTH),
});
const urlFilters = { urlFilters: z.array(ZUrlFilterInput).max(ACTION_CLASS_URL_FILTERS_MAX) };

const ZElementSelector = ZClickConfig.shape.elementSelector;
const ZElementSelectorInput = ZElementSelector.safeExtend({
  cssSelector: ZElementSelector.shape.cssSelector
    .unwrap()
    .max(ACTION_CLASS_ELEMENT_SELECTOR_MAX_LENGTH)
    .optional(),
  innerHtml: ZElementSelector.shape.innerHtml
    .unwrap()
    .max(ACTION_CLASS_ELEMENT_SELECTOR_MAX_LENGTH)
    .optional(),
});

/**
 * `ZActionClassNoCodeConfig`, every free-text field and the filter list bounded. Discriminated on `type`,
 * which each variant fixes, so a refusal names the field inside the variant rather than the whole config.
 */
const ZNoCodeConfigInput = z.discriminatedUnion("type", [
  ZClickConfig.safeExtend({ ...urlFilters, elementSelector: ZElementSelectorInput }),
  ZPageViewConfig.safeExtend(urlFilters),
  ZExitIntentConfig.safeExtend(urlFilters),
  ZScrollConfig.safeExtend(urlFilters),
  ZPageDwellConfig.safeExtend(urlFilters),
]);

const boundedBase = {
  name: ZCodeInput.shape.name.max(V3_NAME_MAX_LENGTH),
  description: ZCodeInput.shape.description.unwrap().unwrap().max(ATTRIBUTE_DESCRIPTION_MAX_LENGTH).nullish(),
};

/**
 * An action as the forms build it, strict at every level. No `workspaceId`: a new action goes into the
 * query's workspace, and an edited one always stays in the workspace it belongs to.
 */
const ZActionClassBody = z.discriminatedUnion("type", [
  strictDeep(
    ZCodeInput.omit({ workspaceId: true }).extend({
      ...boundedBase,
      key: ZCodeInput.shape.key.unwrap().max(ACTION_CLASS_KEY_MAX_LENGTH).nullable(),
    })
  ),
  strictDeep(
    ZNoCodeInput.omit({ workspaceId: true }).extend({
      ...boundedBase,
      noCodeConfig: ZNoCodeConfigInput.nullable(),
    })
  ),
]);

/** A new action as the survey editor's "Create new action" form builds it. */
export const ZActionClassCreateBody = ZActionClassBody;

/** The whole action as the settings form edits it. */
export const ZActionClassPatchBody = ZActionClassBody;

/** The survey the editor is open on, left out of the list of other surveys using the action. */
export const ZActionClassSurveysQuery = z.object({ excludeSurveyId: ZId.optional() }).strict();

export type TActionClassPatchBody = z.infer<typeof ZActionClassPatchBody>;
export type TActionClassCreateBody = z.infer<typeof ZActionClassCreateBody>;

/** The names of the surveys an action triggers, split by whether they are running. */
export type TActionClassSurveysResource = { activeSurveys: string[]; inactiveSurveys: string[] };

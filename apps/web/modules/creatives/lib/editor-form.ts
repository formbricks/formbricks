import type { z } from "zod";
import type {
  CreativeResourceZodType,
  CreativeTextRunZodType,
  CreativeTypeZodType,
  FeedbackButtonContentZodType,
  zCreateCreativeRequest,
  zPatchCreativeRequest,
} from "@formbricks/api-v3-schemas";

/**
 * The editor's form and the v3 bodies it sends (ENG-3997, ENG-4003). The form holds what the Content,
 * Language and Schedule tabs edit: the texts in the creative's default language, and every other
 * language with its translations; everything else (styling, distribution) stays on the stored resource.
 * A save sends only the groups the editor owns, so the groups other tabs will own keep their server
 * values until those tabs save them.
 */

export type TCreativeResource = CreativeResourceZodType;
export type TCreativeResourceType = CreativeTypeZodType;
export type TCreativeTextRun = CreativeTextRunZodType;
export type TFeedbackButtonIcon = NonNullable<FeedbackButtonContentZodType["icon"]>;
/** Request bodies as sent: the input side of the contract schemas, where defaulted fields may be omitted. */
export type TCreativePatchBody = z.input<typeof zPatchCreativeRequest>;
export type TCreateCreativeBody = z.input<typeof zCreateCreativeRequest>;

/**
 * The POST body behind "New creative": a Draft of the picked type, with only what the type requires.
 * Styling, distribution and schedule are left to the server defaults (the workspace look, every page
 * view, no schedule). `defaultLanguage` is the one a new survey would get (the workspace's default
 * survey language, else the author's); `label` is the starting button text, in the author's UI language.
 */
export const buildNewCreativeRequest = ({
  workspaceId,
  type,
  name,
  label,
  defaultLanguage,
}: {
  workspaceId: string;
  type: TCreativeResourceType;
  name: string;
  label: string;
  defaultLanguage: string;
}): TCreateCreativeBody =>
  type === "feedbackButton"
    ? {
        workspaceId,
        name,
        type,
        defaultLanguage,
        content: { label: { [defaultLanguage]: label }, icon: "messageSquare" },
      }
    : {
        workspaceId,
        name,
        type,
        defaultLanguage,
        content: {
          message: { [defaultLanguage]: [] },
          button: null,
          dismissible: true,
          accessibleName: null,
        },
      };

export type TFeedbackButtonForm = { type: "feedbackButton"; label: string; icon: TFeedbackButtonIcon | null };

export type TBannerForm = {
  type: "banner";
  message: TCreativeTextRun[];
  /** The button switch. Its label is kept while the switch is off, so turning it back on restores it. */
  hasButton: boolean;
  buttonLabel: string;
  dismissible: boolean;
  /** Empty means the default, "Site notice" in the visitor's language. */
  accessibleName: string;
};

/**
 * What pressing the creative opens, as the On click panel holds it: the chosen kind with its value, even
 * when nothing is picked yet. A banner without a button keeps its choice here but sends none.
 */
export type TCreativeDestinationForm =
  | { type: "survey"; surveyId: string | null }
  | { type: "link"; url: string };

/**
 * One other language's texts, as the Language tab edits them. Only the fields the creative's type and
 * content use matter; a blank one isn't sent, so visitors in that language get the default's text.
 */
export type TCreativeTranslation = {
  label: string;
  message: TCreativeTextRun[];
  buttonLabel: string;
  accessibleName: string;
};

/** The Language tab: the default language the Content tab writes in, and every other one. */
export type TCreativeLanguagesForm = {
  defaultLanguage: string;
  /** In order; `enabled: false` keeps the translation but shows visitors the default. */
  others: { code: string; enabled: boolean }[];
  /** Keyed by the codes in `others`. */
  texts: Record<string, TCreativeTranslation>;
};

export interface TCreativeEditorForm {
  name: string;
  content: TFeedbackButtonForm | TBannerForm;
  destination: TCreativeDestinationForm;
  schedule: { startAt: Date | null; endAt: Date | null };
  languages: TCreativeLanguagesForm;
}

export type TCreativeSaveIntent = "save" | "publish";

const toDate = (value: string | null): Date | null => (value === null ? null : new Date(value));

const toContentForm = (resource: TCreativeResource): TCreativeEditorForm["content"] => {
  const language = resource.defaultLanguage;
  if (resource.type === "feedbackButton") {
    return {
      type: "feedbackButton",
      label: resource.content.label[language] ?? "",
      icon: resource.content.icon,
    };
  }
  const { message, button, dismissible, accessibleName } = resource.content;
  return {
    type: "banner",
    message: message[language] ?? [],
    hasButton: button !== null,
    buttonLabel: button?.label[language] ?? "",
    dismissible,
    accessibleName: accessibleName?.[language] ?? "",
  };
};

const toDestinationForm = (destination: TCreativeResource["destination"]): TCreativeDestinationForm => {
  if (destination?.type === "link") return { type: "link", url: destination.url };
  return { type: "survey", surveyId: destination?.surveyId ?? null };
};

const toTranslation = (resource: TCreativeResource, code: string): TCreativeTranslation => {
  if (resource.type === "feedbackButton") {
    return { label: resource.content.label[code] ?? "", message: [], buttonLabel: "", accessibleName: "" };
  }
  const { message, button, accessibleName } = resource.content;
  return {
    label: "",
    message: message[code] ?? [],
    buttonLabel: button?.label[code] ?? "",
    accessibleName: accessibleName?.[code] ?? "",
  };
};

const toLanguagesForm = (resource: TCreativeResource): TCreativeLanguagesForm => {
  const others = resource.languages
    .filter((language) => language.code !== resource.defaultLanguage)
    .map(({ code, enabled }) => ({ code, enabled }));
  return {
    defaultLanguage: resource.defaultLanguage,
    others,
    texts: Object.fromEntries(others.map(({ code }) => [code, toTranslation(resource, code)])),
  };
};

export const toCreativeEditorForm = (resource: TCreativeResource): TCreativeEditorForm => ({
  name: resource.name,
  content: toContentForm(resource),
  destination: toDestinationForm(resource.destination),
  schedule: { startAt: toDate(resource.schedule.startAt), endAt: toDate(resource.schedule.endAt) },
  languages: toLanguagesForm(resource),
});

/** A feedback button always opens something; a banner only when it has a button. */
export const formNeedsDestination = (content: TCreativeEditorForm["content"]): boolean =>
  content.type === "feedbackButton" || content.hasButton;

const toDestinationBody = (form: TCreativeEditorForm): TCreativePatchBody["destination"] => {
  if (!formNeedsDestination(form.content)) return null;
  const { destination } = form;
  if (destination.type === "survey") {
    return destination.surveyId ? { type: "survey", surveyId: destination.surveyId } : null;
  }
  const url = destination.url.trim();
  return url ? { type: "link", url } : null;
};

/**
 * A text in every language that has it: the default's as written, each other language's unless blank
 * (a missing translation shows visitors the default's). Built from the form alone, so a removed
 * language takes its texts with it and no key is left the server would refuse as undeclared.
 */
const toTextMap = <T>(
  { defaultLanguage, others, texts }: TCreativeLanguagesForm,
  defaultValue: T,
  read: (translation: TCreativeTranslation) => T,
  isBlank: (value: T) => boolean
): Record<string, T> => {
  const map: Record<string, T> = { [defaultLanguage]: defaultValue };
  for (const { code } of others) {
    const translation = texts[code];
    if (translation && !isBlank(read(translation))) map[code] = read(translation);
  }
  return map;
};

const isBlankText = (value: string): boolean => value.trim() === "";
const isBlankMessage = (runs: TCreativeTextRun[]): boolean => runs.every((run) => isBlankText(run.text));

const toContentBody = (
  { content, languages }: TCreativeEditorForm,
  resource: TCreativeResource
): NonNullable<TCreativePatchBody["content"]> => {
  if (content.type === "feedbackButton" && resource.type === "feedbackButton") {
    return {
      label: toTextMap(languages, content.label, (texts) => texts.label, isBlankText),
      icon: content.icon,
    };
  }
  if (content.type === "banner" && resource.type === "banner") {
    const accessibleName = content.accessibleName.trim();
    return {
      message: toTextMap(languages, content.message, (texts) => texts.message, isBlankMessage),
      button: content.hasButton
        ? { label: toTextMap(languages, content.buttonLabel, (texts) => texts.buttonLabel, isBlankText) }
        : null,
      dismissible: content.dismissible,
      // Translated only while the default language has one; otherwise visitors hear "Site notice".
      accessibleName: accessibleName
        ? toTextMap(languages, accessibleName, (texts) => texts.accessibleName.trim(), isBlankText)
        : null,
    };
  }
  throw new Error(`A ${resource.type} creative can't take ${content.type} content.`);
};

/** `defaultLanguage` and `languages` when the Language tab changed them; the server replaces both. */
const toLanguagesBody = (
  { defaultLanguage, others }: TCreativeLanguagesForm,
  resource: TCreativeResource
): Pick<TCreativePatchBody, "defaultLanguage" | "languages"> => {
  const stored = toLanguagesForm(resource);
  const isUnchanged =
    defaultLanguage === stored.defaultLanguage && JSON.stringify(others) === JSON.stringify(stored.others);
  return isUnchanged ? {} : { defaultLanguage, languages: others };
};

/**
 * The PATCH body for Save or Publish: the groups the editor owns, in full. Publish also sets the author's
 * status to `inProgress`; the server derives what that shows as (Active, Scheduled, Paused with its survey).
 */
export const buildCreativePatch = (
  form: TCreativeEditorForm,
  resource: TCreativeResource,
  intent: TCreativeSaveIntent
): TCreativePatchBody => ({
  name: form.name.trim(),
  ...toLanguagesBody(form.languages, resource),
  content: toContentBody(form, resource),
  destination: toDestinationBody(form),
  schedule: {
    startAt: form.schedule.startAt?.toISOString() ?? null,
    endAt: form.schedule.endAt?.toISOString() ?? null,
  },
  ...(intent === "publish" && { status: "inProgress" as const }),
});

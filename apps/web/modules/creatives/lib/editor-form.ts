import type { z } from "zod";
import type {
  CreativeResourceZodType,
  CreativeTextRunZodType,
  CreativeTypeZodType,
  FeedbackButtonContentZodType,
  zCreateCreativeRequest,
  zPatchCreativeRequest,
} from "@formbricks/api-v3-schemas";
import { type TCreativeStylingForm, toStylingBody, toStylingForm } from "./styling-form";

/**
 * The editor's form and the v3 bodies it sends (ENG-3997, ENG-4005). The form holds what the Content,
 * Styling and Schedule tabs edit, texts in the creative's default language; everything else (other
 * languages, distribution) stays on the stored resource. A save sends only the groups the editor owns, each built
 * from the stored one, so texts in other languages survive and the groups other tabs will own keep their
 * server values until those tabs save them.
 */

export type TCreativeResource = CreativeResourceZodType;
export type TCreativeResourceType = CreativeTypeZodType;
export type TCreativeTextRun = CreativeTextRunZodType;
export type TFeedbackButtonIcon = NonNullable<FeedbackButtonContentZodType["icon"]>;
/** Request bodies as sent: the input side of the contract schemas, where defaulted fields may be omitted. */
export type TCreativePatchBody = z.input<typeof zPatchCreativeRequest>;
export type TCreateCreativeBody = z.input<typeof zCreateCreativeRequest>;

/**
 * The language a new creative's texts start in: the API's own default. Picking another one is the
 * Languages work (ENG-4003); until then the editor writes whatever `defaultLanguage` the creative has.
 */
const NEW_CREATIVE_LANGUAGE = "en-US";

/**
 * The POST body behind "New creative": a Draft of the picked type, with only what the type requires.
 * Styling, distribution and schedule are left to the server defaults (the workspace look, every page
 * view, no schedule). `label` is the starting button text, in the author's own UI language.
 */
export const buildNewCreativeRequest = ({
  workspaceId,
  type,
  name,
  label,
}: {
  workspaceId: string;
  type: TCreativeResourceType;
  name: string;
  label: string;
}): TCreateCreativeBody =>
  type === "feedbackButton"
    ? {
        workspaceId,
        name,
        type,
        content: { label: { [NEW_CREATIVE_LANGUAGE]: label }, icon: "messageSquare" },
      }
    : {
        workspaceId,
        name,
        type,
        content: {
          message: { [NEW_CREATIVE_LANGUAGE]: [] },
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

export interface TCreativeEditorForm {
  name: string;
  content: TFeedbackButtonForm | TBannerForm;
  destination: TCreativeDestinationForm;
  styling: TCreativeStylingForm;
  schedule: { startAt: Date | null; endAt: Date | null };
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

export const toCreativeEditorForm = (resource: TCreativeResource): TCreativeEditorForm => ({
  name: resource.name,
  content: toContentForm(resource),
  destination: toDestinationForm(resource.destination),
  styling: toStylingForm(resource),
  schedule: { startAt: toDate(resource.schedule.startAt), endAt: toDate(resource.schedule.endAt) },
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

const toContentBody = (
  content: TCreativeEditorForm["content"],
  resource: TCreativeResource
): NonNullable<TCreativePatchBody["content"]> => {
  const language = resource.defaultLanguage;
  if (content.type === "feedbackButton" && resource.type === "feedbackButton") {
    return { label: { ...resource.content.label, [language]: content.label }, icon: content.icon };
  }
  if (content.type === "banner" && resource.type === "banner") {
    const stored = resource.content;
    const accessibleName = content.accessibleName.trim();
    return {
      message: { ...stored.message, [language]: content.message },
      button: content.hasButton
        ? { label: { ...stored.button?.label, [language]: content.buttonLabel } }
        : null,
      dismissible: content.dismissible,
      accessibleName: accessibleName ? { ...stored.accessibleName, [language]: accessibleName } : null,
    };
  }
  throw new Error(`A ${resource.type} creative can't take ${content.type} content.`);
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
  content: toContentBody(form.content, resource),
  destination: toDestinationBody(form),
  styling: toStylingBody(form.styling),
  schedule: {
    startAt: form.schedule.startAt?.toISOString() ?? null,
    endAt: form.schedule.endAt?.toISOString() ?? null,
  },
  ...(intent === "publish" && { status: "inProgress" as const }),
});

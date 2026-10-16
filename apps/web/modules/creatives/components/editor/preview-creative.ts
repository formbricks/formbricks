import { getBannerPlainText } from "../../lib/banner-text";
import type { TCreativeEditorForm, TCreativeResource, TFeedbackButtonIcon } from "../../lib/editor-form";
import type { TCreative, TCreativeIcon, TCreativeTargeting } from "../../types";

/**
 * A bridge to the prototype's `TCreative`, which the Styling and Settings tabs and the stand-in preview
 * still read. Their own state (`look`, `targeting`) is local and unsaved until ENG-4005 (Styling and the
 * real renderer) and ENG-4002 (Show on, Show when, Share of visitors) move them onto the v3 groups; the
 * Content and Schedule fields come from the real form, so the preview follows what will be saved.
 */

export type TPreviewLook = Pick<TCreative, "styling" | "layout">;

const PREVIEW_ICONS: Record<TFeedbackButtonIcon, TCreativeIcon> = {
  messageSquare: "message_square",
  messageCircle: "message_circle",
  megaphone: "megaphone",
  sparkles: "sparkles",
};

const toPreviewContent = (content: TCreativeEditorForm["content"]): TCreative["content"] =>
  content.type === "feedbackButton"
    ? {
        label: content.label,
        icon: content.icon ? PREVIEW_ICONS[content.icon] : null,
        message: "",
        dismissible: false,
      }
    : {
        label: content.hasButton ? content.buttonLabel : "",
        icon: null,
        message: getBannerPlainText(content.message),
        dismissible: content.dismissible,
      };

const toDate = (value: string | null): Date | null => (value ? new Date(value) : null);

export const toPreviewCreative = ({
  creative,
  form,
  look,
  targeting,
}: {
  creative: TCreativeResource;
  form: TCreativeEditorForm;
  look: TPreviewLook;
  targeting: TCreativeTargeting;
}): TCreative => ({
  id: creative.id,
  name: form.name,
  type: creative.type === "feedbackButton" ? "feedback_button" : "banner",
  status: creative.status,
  archivedAt: toDate(creative.archivedAt),
  publishedAt: toDate(creative.publishedAt),
  startsAt: form.schedule.startAt,
  endsAt: form.schedule.endAt,
  action:
    form.destination.type === "survey"
      ? { kind: "survey", surveyId: form.destination.surveyId }
      : { kind: "link", url: form.destination.url },
  content: toPreviewContent(form.content),
  styling: look.styling,
  layout: look.layout,
  targeting,
  createdAt: new Date(creative.createdAt),
  updatedAt: new Date(creative.updatedAt),
  creatorName: creative.creator?.name ?? null,
  daily: [],
  pages: [],
});

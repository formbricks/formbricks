import type { TCreativeDestination, TCreativeStyle, TCreativeView } from "@formbricks/creatives";
import type { TCreativeEditorForm } from "./editor-form";

/**
 * `render` never reads a view's Destination: on a site the SDK resolves a click itself
 * (`resolveClick`). The editor preview handles the click on its own and describes what the form picked,
 * so a creative with something to open carries this stand-in instead of a half-filled Destination.
 */
const PREVIEW_DESTINATION: TCreativeDestination = { type: "link", url: "about:blank" };

/** The words a banner shows visitors that its author doesn't write (`workspace.creatives.visitor_*`). */
export type TPreviewVisitorLabels = Readonly<{ siteNotice: string; dismiss: string }>;

/**
 * What the editor preview hands to `@formbricks/creatives`' `render` (ADR 0003): the unsaved form, with
 * the look `getCreativeStyle` computed from it, in the shape `resolve` builds for a visitor. Texts are the
 * default language's, as the form edits them; the visitor words come translated from the editor, as the
 * payload's `labels` do for a visitor.
 */
export const toPreviewView = (
  id: string,
  form: TCreativeEditorForm,
  style: TCreativeStyle,
  labels: TPreviewVisitorLabels
): TCreativeView => {
  const { content, styling } = form;

  if (content.type === "feedbackButton" && styling.type === "feedbackButton") {
    return {
      id,
      type: "feedbackButton",
      label: content.label,
      icon: content.icon,
      position: styling.position,
      style,
      destination: PREVIEW_DESTINATION,
    };
  }
  if (content.type === "banner" && styling.type === "banner") {
    return {
      id,
      type: "banner",
      message: content.message,
      buttonLabel: content.hasButton ? content.buttonLabel : null,
      dismissible: content.dismissible,
      accessibleName: content.accessibleName.trim() || labels.siteNotice,
      dismissLabel: labels.dismiss,
      position: styling.position,
      style,
      destination: content.hasButton ? PREVIEW_DESTINATION : null,
    };
  }
  throw new Error(`A ${content.type} creative can't take ${styling.type} styling.`);
};

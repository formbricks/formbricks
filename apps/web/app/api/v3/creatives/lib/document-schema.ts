import { z } from "zod";
import {
  zCreateBannerCreativeRequest,
  zCreateFeedbackButtonCreativeRequest,
} from "@formbricks/api-v3-schemas";
import {
  DEFAULT_CREATIVE_STYLING,
  type TCreativeState,
  toCreativeShowConditions,
} from "@/modules/ee/creatives/lib/creative";
import type { TCreativePatchInput } from "@/modules/ee/creatives/lib/write-rules";
import { refineNoNullBytes, refineShowConditions, refineWebLinks } from "./schemas";

/**
 * A creative as a pull/push document (ADR 0015): its editable state and nothing the server owns.
 *
 * Built from the create request, so it accepts exactly what a create accepts and refuses what a create
 * refuses (unknown keys included, naming them): `workspaceId` and `status` are dropped because a push never
 * moves a creative between workspaces or through its lifecycle. `type` stays as the discriminator that
 * picks the `content` and `styling` shape; it never changes, so a push naming another type is refused.
 *
 * A push replaces: what the document omits resets to what a create without it would store (no languages, no
 * destination, show on every page view, no schedule, the type's default styling).
 */

const SERVER_OWNED = { workspaceId: true, status: true } as const;

export const ZV3CreativeDocument = z
  .discriminatedUnion("type", [
    zCreateFeedbackButtonCreativeRequest.omit(SERVER_OWNED).extend({ type: z.literal("feedbackButton") }),
    zCreateBannerCreativeRequest.omit(SERVER_OWNED).extend({ type: z.literal("banner") }),
  ])
  .superRefine((document, ctx) => {
    refineNoNullBytes(document, ctx);
    refineShowConditions(document.distribution, ctx);
    refineWebLinks(document, ctx);
  });
export type TV3CreativeDocument = z.infer<typeof ZV3CreativeDocument>;

/**
 * The document of a stored state, every field present. The key order is fixed so two documents compare
 * with `diffDocuments`; a pushed document is compared as the state it builds, never as the JSON it came as.
 */
export const toCreativeDocument = (state: TCreativeState): Record<string, unknown> => ({
  type: state.type,
  name: state.name,
  defaultLanguage: state.defaultLanguage,
  languages: state.languages.map(({ code, enabled }) => ({ code, enabled })),
  content: state.content,
  styling: state.styling,
  destination: state.destination,
  distribution: {
    showOn: state.distribution.showOn,
    triggers: state.distribution.triggers.map(({ actionClassId }) => ({ actionClassId })),
    conditions: toCreativeShowConditions(state.distribution.conditions),
    displayPercentage: state.distribution.displayPercentage,
  },
  schedule: {
    startAt: state.schedule.startAt?.toISOString() ?? null,
    endAt: state.schedule.endAt?.toISOString() ?? null,
  },
});

/**
 * The patch that replaces every group with the document's: an omitted group is sent as its default rather
 * than left out, which is what turns the patch rules (`applyCreativePatch`) into replace semantics. `status`
 * is never sent, so the creative keeps its own.
 */
export const toCreativeReplacePatch = (document: TV3CreativeDocument): TCreativePatchInput => ({
  name: document.name,
  defaultLanguage: document.defaultLanguage,
  languages: document.languages ?? [],
  content: document.content,
  styling: document.styling ?? DEFAULT_CREATIVE_STYLING[document.type],
  destination: document.destination ?? null,
  distribution: document.distribution ?? {
    showOn: "pageView",
    triggers: [],
    conditions: null,
    displayPercentage: null,
  },
  schedule: document.schedule ?? { startAt: null, endAt: null },
});

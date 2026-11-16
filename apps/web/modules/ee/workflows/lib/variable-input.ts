import { extractCompleteRecallIds } from "@/lib/utils/recall";
import type { TEditorRecallSource } from "@/modules/ui/components/editor/components/recall-source";

/**
 * A one-line field that takes Variables (an HTTP query parameter or header value, an Embedded Data
 * value on a survey link) stores recall tokens (`#recall:payload.customer.id/fallback:#`, ADR 0045)
 * and shows each as the chip the email body uses.
 */

/**
 * The recall source with an item for every complete token in the text. The editor drops a token
 * its source can't name, which in a one-line field would rewrite the stored value the moment the
 * panel opens; a token the source doesn't know (a bare id written through the API) keeps a chip
 * named after its id instead.
 */
export const withEveryRecallTokenKept = (source: TEditorRecallSource): TEditorRecallSource => ({
  ...source,
  getRecallItems: (text) => {
    const items = source.getRecallItems(text);
    const known = new Set(items.map((item) => item.id));
    const unknown = [...new Set(extractCompleteRecallIds(text))].filter((id) => !known.has(id));
    return [...items, ...unknown.map((id) => ({ id, label: id, type: "variable" as const }))];
  },
});

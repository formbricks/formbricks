import { z } from "zod";
import { ZMcpPushDocumentInput } from "../../tools/document-schemas";

/**
 * The input of `push_document`, minus the two switches a review must never take from the agent: `dryRun`
 * (a review always is one) and `confirmDestructive` (only the person confirms that, in the view, and the
 * view adds it to the push itself). Everything else is the push's own schema, so the arguments the model
 * reviews are exactly the ones the view later pushes.
 */
export const ZMcpReviewDocumentChangeInput = ZMcpPushDocumentInput.omit({
  dryRun: true,
  confirmDestructive: true,
});

export type TMcpReviewDocumentChangeInput = z.infer<typeof ZMcpReviewDocumentChangeInput>;

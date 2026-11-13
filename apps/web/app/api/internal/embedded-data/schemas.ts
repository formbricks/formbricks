import { z } from "zod";
import { ZId } from "@formbricks/types/common";
import { EMBEDDED_DATA_KEY_MAX_LENGTH } from "@formbricks/types/embedded-data";
import {
  ZCreateSharedEmbeddedDataInput,
  ZPromoteEmbeddedDataInput,
  ZUpdateSharedEmbeddedDataInput,
} from "@/modules/embedded-data/types";

export const ZEmbeddedDataListQuery = z.object({ workspaceId: ZId }).strict();

export const ZEmbeddedDataIdParams = z.object({ embeddedDataId: ZId }).strict();

/**
 * The library key a create or a promote names, capped where the body is parsed rather than only when the
 * service checks the row (`assertValidRow`), so an oversized key is refused before any work.
 */
const ZEmbeddedDataKey = z.string().max(EMBEDDED_DATA_KEY_MAX_LENGTH);

/** A new library field. The cross-field rules live on the row schema the service runs, not here. */
export const ZEmbeddedDataCreateBody = ZCreateSharedEmbeddedDataInput.extend({
  key: ZEmbeddedDataKey,
}).strict();

/**
 * A change to a library field. `acknowledgeExistingResponses` is the author's answer to the 409 a guarded
 * `dataType` change raises: the same edit is sent twice, and only the second carries it.
 */
export const ZEmbeddedDataUpdateBody = ZUpdateSharedEmbeddedDataInput.extend({
  acknowledgeExistingResponses: z.boolean().optional(),
}).strict();

/** Promoting a survey's local field into the library: the library key it is filed under. */
export const ZEmbeddedDataPromoteBody = ZPromoteEmbeddedDataInput.extend({ key: ZEmbeddedDataKey }).strict();

export type TEmbeddedDataCreateBody = z.infer<typeof ZEmbeddedDataCreateBody>;
export type TEmbeddedDataUpdateBody = z.infer<typeof ZEmbeddedDataUpdateBody>;
export type TEmbeddedDataPromoteBody = z.infer<typeof ZEmbeddedDataPromoteBody>;

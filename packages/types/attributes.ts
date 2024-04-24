import { z } from "zod";

import { ZId } from "./environment";

export const ZAttributes = z.record(z.string());

export type TAttributes = z.infer<typeof ZAttributes>;

export const ZAttributeUpdateInput = z.object({
  environmentId: ZId,
  userId: z.string(),
  attributes: ZAttributes,
});

export type TAttributeUpdateInput = z.infer<typeof ZAttributeUpdateInput>;

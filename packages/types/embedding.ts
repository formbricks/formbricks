import { z } from "zod";

export const ZEmbedding = z.array(z.number()).length(1024);

export type TEmbedding = z.infer<typeof ZEmbedding>;

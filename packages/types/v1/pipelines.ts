import { z } from "zod";

export const ZPipelineTrigger = z.enum(["responseFinished", "responseCreated", "responseUpdated"]);

export type TPipelineTrigger = z.infer<typeof ZPipelineTrigger>;

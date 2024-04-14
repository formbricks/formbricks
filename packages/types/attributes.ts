import { z } from "zod";

export const ZAttributes = z.record(z.string());

export type TAttributes = z.infer<typeof ZAttributes>;

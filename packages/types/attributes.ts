import { z } from "zod";

export const ZAttributes = z.record(z.union([z.string(), z.number()]));

export type TAttributes = z.infer<typeof ZAttributes>;

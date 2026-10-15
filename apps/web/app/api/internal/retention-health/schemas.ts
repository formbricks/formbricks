import { z } from "zod";

export const ZRetentionHealthQuery = z.object({ organizationId: z.cuid2() }).strict();

export type TRetentionHealthQuery = z.infer<typeof ZRetentionHealthQuery>;

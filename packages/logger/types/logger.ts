import { z } from "zod";

export const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;

export const ZLogLevel = z.enum(LOG_LEVELS);

export type TLogLevel = z.infer<typeof ZLogLevel>;

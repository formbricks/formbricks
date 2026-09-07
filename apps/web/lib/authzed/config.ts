import "server-only";
import { env } from "@/lib/env";

export type TAuthzedConsistency = "minimize_latency" | "fully_consistent";

const parseAuthzedBoolean = (value: "true" | "false" | "1" | "0" | undefined): boolean =>
  value === "true" || value === "1";

export const isAuthzedEnabled = (): boolean => parseAuthzedBoolean(env.AUTHZED_ENABLED);

import type { Session } from "next-auth";
import type { TAuthenticationApiKey } from "@formbricks/types/auth";

export type TV3Authentication = TAuthenticationApiKey | Session | null;

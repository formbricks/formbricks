import type { Session, TAuthenticationApiKey } from "@formbricks/types/auth";
import type { TApiAuditLog } from "@/app/lib/api/with-api-logging";

export type TV3Authentication = TAuthenticationApiKey | Session | null;
export type TV3AuditLog = TApiAuditLog;

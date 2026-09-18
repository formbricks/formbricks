import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import type { TAuditLogEvent } from "@/modules/ee/audit-logs/types/audit-log";

export interface AuthMutation {
  model: string;
  id: string;
  operation: "create" | "update" | "delete";
  fields: string[];
  subjectId?: string;
  clientId?: string;
  flags?: Record<string, { before?: boolean; after: boolean }>;
}

export interface NativeAuthAuditContext {
  path: string;
  requestId: string;
  actor: TAuditLogEvent["actor"];
  target?: TAuditLogEvent["target"];
  targetModels: string[];
  mutations: AuthMutation[];
  mutationFailed?: boolean;
  failureAudited?: boolean;
  oauthClientId?: string;
  observationIncomplete?: boolean;
  authenticationStage?: "password";
}

export const nativeAuthAuditContext = new AsyncLocalStorage<NativeAuthAuditContext>();

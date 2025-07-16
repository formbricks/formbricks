import { redactPII } from "@/modules/ee/audit-logs/lib/utils";

export const createDebugContext = (contextObject: Record<string, any>) => {
  const correlationId = crypto.randomUUID();

  const context = {
    correlationId,
    ...contextObject,
  };

  return { ...redactPII(context), name: "formbricks" };
};

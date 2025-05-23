import { AUDIT_LOG_ENABLED, AUDIT_LOG_PATH } from "@/lib/constants";
import Pino, { type Logger, type LoggerOptions } from "pino";

// Ensure the audit logger has a consistent format
const auditLoggerConfig: LoggerOptions = {
  level: "info",
  base: undefined,
  timestamp: false,
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport: {
    target: "pino/file",
    options: {
      destination: AUDIT_LOG_PATH,
      mkdir: true,
      append: true,
    },
  },
};

// Create a dedicated Pino instance for audit logs
const auditLogger: Logger = AUDIT_LOG_ENABLED ? Pino(auditLoggerConfig) : Pino({ enabled: false });

export { auditLogger };

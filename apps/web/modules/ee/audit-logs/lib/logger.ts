import { AUDIT_LOG_ENABLED, AUDIT_LOG_PATH } from "@/lib/constants";
import fs from "fs";
import Pino, { type Logger, type LoggerOptions } from "pino";
import { logger } from "@formbricks/logger";

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

// Set restrictive permissions on the audit log file for compliance
if (AUDIT_LOG_ENABLED) {
  try {
    fs.chmodSync(AUDIT_LOG_PATH, 0o600);
  } catch (e) {
    // Ignore error if file does not exist yet; it will be created on first log write
    logger.error("Error setting audit log file permissions", e);
    logger.info("file will be created on first log write");
  }
}

export { auditLogger };

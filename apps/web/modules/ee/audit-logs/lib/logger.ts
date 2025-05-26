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

// ---
// ENTERPRISE LOG FILE PERMISSIONS COMPLIANCE
//
// For compliance (GDPR, SOC2, etc.), the audit log file must be readable/writable only by the app user (0o600).
// Pino and Node.js may create the file with default permissions (0644), and reliably hooking into the stream is not always possible.
//
// To guarantee compliance regardless of logger internals, we enforce permissions to 0o600 on a short interval (every 5 seconds).
// This approach is robust, works even if the file is rotated or recreated, and has NEGLIGIBLE performance impact—even for high-frequency logging—because chmod is only called if the file exists and only changes metadata.
// ---
if (AUDIT_LOG_ENABLED) {
  setInterval(() => {
    try {
      if (fs.existsSync(AUDIT_LOG_PATH)) {
        const stat = fs.statSync(AUDIT_LOG_PATH);
        // Only set if not already 0o600
        if ((stat.mode & 0o777) !== 0o600) {
          fs.chmodSync(AUDIT_LOG_PATH, 0o600);
        }
      }
    } catch (e) {
      logger.error("Error setting audit log file permissions on interval", e);
    }
  }, 5000); // every 5 seconds
}

export { auditLogger };

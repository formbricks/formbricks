// next-logger.config.js

const pino = require("pino");

//Map to Google LogSeverity https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
const PinoLevelToSeverityLookup = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
};
const MESSAGE_KEY = "message";

const logger = (defaultConfig) =>
  pino({
    ...defaultConfig,
    messageKey: MESSAGE_KEY,
    level: process.env.LOG_LEVEL || "debug",
    mixin: () => ({ projectName: "formbricks", env: process.env.NODE_ENV }),

    ...(process.env.NODE_ENV !== "production"
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              messageKey: MESSAGE_KEY,
              levelKey: "severity",
            },
          },
        }
      : {}),

    formatters: {
      level(label, number) {
        return {
          severity: PinoLevelToSeverityLookup[label] || PinoLevelToSeverityLookup["info"],
          level: number,
        };
      },
      // log(object) {
      //     return {
      //         ...object,
      //     };
      // },
    },
  });

function getCallerInfo() {
  const originalFunc = Error.prepareStackTrace;

  try {
    const err = new Error();
    Error.prepareStackTrace = (_, stack) => stack;
    const stack = err.stack;

    const caller = stack[2]; // L'indice 2 dovrebbe essere il chiamante
    const callerFile = caller.getFileName();
    const callerLine = caller.getLineNumber();
    const callerColumn = caller.getColumnNumber();

    return {
      file: callerFile,
      line: callerLine,
      column: callerColumn,
    };
  } catch (e) {
    return null;
  } finally {
    Error.prepareStackTrace = originalFunc;
  }
}

const getLogger = (bindings) => {
  const callerInfo = getCallerInfo();
  return logger().child({ caller: callerInfo, ...bindings });
};

module.exports = {
  logger,
  getLogger,
};

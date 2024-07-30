import { Logger, pino } from "pino";

export const logger: Logger = pino({
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
    },
  },
  // level: process.env.PINO_LOG_LEVEL || "info",
  level: "debug",

  redact: [], // prevent logging of sensitive data
});

function getCallerInfo() {
  const originalFunc = Error.prepareStackTrace;

  try {
    const err = new Error();
    Error.prepareStackTrace = (_, stack) => stack;
    const stack: any = err.stack;

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

export const getLogger = (bindings: object) => {
  const callerInfo = getCallerInfo();
  return logger.child({ caller: callerInfo, ...bindings });
};

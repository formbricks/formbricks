import "server-only";
import pino, { LevelWithSilentOrString, Logger, LoggerOptions } from "pino";
import { IS_PRODUCTION } from "@formbricks/lib/constants";

const getLogLevel = (): LevelWithSilentOrString => {
  // const envLogLevel = process.env.LOG_LEVEL;
  const envLogLevel = "info";

  if (envLogLevel) return envLogLevel;

  if (IS_PRODUCTION) return "warn";
  return "info";
};

const baseLoggerConfig: LoggerOptions = {
  level: getLogLevel(),
  timestamp: true,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  name: "formbricks",

  mixin: () => {
    return { requestId: global.requestId || "n/a" };
  },
};

const developmentConfig: LoggerOptions = {
  ...baseLoggerConfig,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname,ip,requestId",
    },
  },
};

const productionConfig: LoggerOptions = {
  ...baseLoggerConfig,
};

const logger: Logger = IS_PRODUCTION ? pino(productionConfig) : pino(developmentConfig);

const methods = ["info", "error", "warn", "debug", "fatal", "trace", "silent"];

methods.forEach((method) => {
  logger[method] = logger[method].bind(logger);
});

const FormbricksLogger = {
  ...logger,
  withContext: (context: Record<string, any>) => {
    return logger.child(context);
  },
  request: (req: any) => {
    return logger.child({
      requestId: req.id || "n/a",
      method: req.method,
      url: req.url,
      ip: req.ip || req.headers["x-forwarded-for"],
    });
  },
};

export default FormbricksLogger;

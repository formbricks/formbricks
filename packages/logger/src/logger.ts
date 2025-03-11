import "server-only";
import pino, { type LevelWithSilentOrString, type Logger, type LoggerOptions } from "pino";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

const getLogLevel = (): LevelWithSilentOrString => {
  const envLogLevel = process.env.LOG_LEVEL;

  if (envLogLevel) return envLogLevel;

  if (IS_PRODUCTION) return "warn";
  return "info";
};

const levels = ["debug", "info", "warn", "error", "fatal"] as const;

const baseLoggerConfig: LoggerOptions = {
  level: getLogLevel(),
  customLevels: {
    debug: 20,
    info: 30,
    warn: 40,
    error: 50,
    fatal: 60,
  },
  useOnlyCustomLevels: true,
  timestamp: true,
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  name: "formbricks",
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

levels.forEach((level) => {
  logger[level] = logger[level].bind(logger);
});

const FormbricksLogger = {
  ...logger,
  withContext: (context: Record<string, unknown>) => {
    return logger.child(context);
  },
  request: (req: Request) => {
    return logger.child({
      method: req.method,
      url: req.url,
    });
  },
};

export default FormbricksLogger;

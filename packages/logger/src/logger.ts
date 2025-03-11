import Pino, { type LevelWithSilentOrString, type Logger, type LoggerOptions } from "pino";

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

const PinoLogger: Logger = IS_PRODUCTION ? Pino(productionConfig) : Pino(developmentConfig);

levels.forEach((level) => {
  PinoLogger[level] = PinoLogger[level].bind(PinoLogger);
});

const logger = {
  ...PinoLogger,
  withContext: (context: Record<string, unknown>) => {
    return PinoLogger.child(context);
  },
  request: (req: Request) => {
    return PinoLogger.child({
      method: req.method,
      url: req.url,
    });
  },
};

export { logger };

import Pino, { type Logger, type LoggerOptions, stdSerializers } from "pino";
import "pino-pretty";
import { LOG_LEVELS, type TLogLevel, ZLogLevel } from "../types/logger";

const IS_PRODUCTION = !process.env.NODE_ENV || process.env.NODE_ENV === "production";
const getLogLevel = (): TLogLevel => {
  let logLevel: TLogLevel = "info";

  if (IS_PRODUCTION) logLevel = "warn";

  const envLogLevel = process.env.LOG_LEVEL;

  const logLevelResult = ZLogLevel.safeParse(envLogLevel);
  if (logLevelResult.success) logLevel = logLevelResult.data;

  return logLevel;
};

const baseLoggerConfig: LoggerOptions = {
  level: getLogLevel(),
  serializers: {
    err: stdSerializers.err,
    req: stdSerializers.req,
    res: stdSerializers.res,
  },
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

const logger: Logger = IS_PRODUCTION ? Pino(productionConfig) : Pino(developmentConfig);

LOG_LEVELS.forEach((level) => {
  logger[level] = logger[level].bind(logger);
});

const extendedLogger = {
  ...logger,
  withContext: (context: Record<string, unknown>) => logger.child(context),
  request: (req: Request) =>
    logger.child({
      method: req.method,
      url: req.url,
    }),
};

const handleShutdown = (event: string, err?: Error): void => {
  if (err) {
    logger.error(err, `Error during shutdown (${event})`);
  }
  logger.info({ event }, "Process is exiting");

  logger.flush();
};

// Create a separate function for attaching Node.js process handlers
const attachNodeProcessHandlers = (): void => {
  // Only attach handlers if we're in a Node.js environment with full process support
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.on("uncaughtException", (err) => {
      handleShutdown("uncaughtException", err);
    });
    process.on("unhandledRejection", (err) => {
      handleShutdown("unhandledRejection", err as Error);
    });
    process.on("SIGTERM", () => {
      handleShutdown("SIGTERM");
    });
    process.on("SIGINT", () => {
      handleShutdown("SIGINT");
    });
  }
};

if (process.env.NEXT_RUNTIME === "nodejs") {
  try {
    attachNodeProcessHandlers();
  } catch (e) {
    logger.error(e, "Error attaching process event handlers");
  }
}

export { extendedLogger as logger };

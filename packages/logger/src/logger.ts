import Pino, { type Logger, type LoggerOptions, stdSerializers } from "pino";
import { type TLogLevel, ZLogLevel } from "../types/logger";

const IS_PRODUCTION = !process.env.NODE_ENV || process.env.NODE_ENV === "production";
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";

const getLogLevel = (): TLogLevel => {
  let logLevel: TLogLevel = "info";

  if (IS_PRODUCTION) logLevel = "warn";
  if (IS_BUILD) logLevel = "error"; // Only show errors during build

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
    audit: 90,
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

/**
 * Build transport configuration based on environment.
 * - Development: pino-pretty for readable console output
 * - Production: JSON to stdout (default Pino behavior)
 * - Both: optional pino-opentelemetry-transport for SigNoz log correlation when OTEL is configured
 */
const buildTransport = (): LoggerOptions["transport"] => {
  const hasOtelEndpoint =
    process.env.NEXT_RUNTIME === "nodejs" && Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);

  const serviceName = process.env.OTEL_SERVICE_NAME ?? "formbricks";
  const serviceVersion = process.env.npm_package_version ?? "0.0.0";

  const otelTarget = {
    target: "pino-opentelemetry-transport",
    options: {
      resourceAttributes: {
        "service.name": serviceName,
        "service.version": serviceVersion,
        "deployment.environment": process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
      },
    },
    level: getLogLevel(),
  };

  const prettyTarget = {
    target: "pino-pretty",
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname,ip,requestId",
      customLevels: "trace:10,debug:20,info:30,audit:35,warn:40,error:50,fatal:60",
      useOnlyCustomProps: true,
    },
    level: getLogLevel(),
  };

  if (!IS_PRODUCTION) {
    // Development: pretty print + optional OTEL
    if (hasOtelEndpoint) {
      return { targets: [prettyTarget, otelTarget] };
    }
    return { target: prettyTarget.target, options: prettyTarget.options };
  }

  // Production: stdout JSON + optional OTEL
  if (hasOtelEndpoint) {
    const fileTarget = {
      target: "pino/file",
      options: { destination: 1 }, // stdout
      level: getLogLevel(),
    };
    return { targets: [fileTarget, otelTarget] };
  }

  return undefined; // Default JSON to stdout
};

const loggerConfig: LoggerOptions = {
  ...baseLoggerConfig,
  transport: buildTransport(),
};

const pinoLogger: Logger = Pino(loggerConfig);

// Ensure all log levels are properly bound
const boundLogger = {
  debug: pinoLogger.debug.bind(pinoLogger),
  info: pinoLogger.info.bind(pinoLogger),
  audit: (pinoLogger as Logger & { audit: typeof pinoLogger.info }).audit.bind(pinoLogger),
  warn: pinoLogger.warn.bind(pinoLogger),
  error: pinoLogger.error.bind(pinoLogger),
  fatal: pinoLogger.fatal.bind(pinoLogger),
};

const extendedLogger = {
  ...boundLogger,
  withContext: (context: Record<string, unknown>) => pinoLogger.child(context),
  request: (req: Request) =>
    pinoLogger.child({
      method: req.method,
      url: req.url,
    }),
};

export type ExtendedLogger = typeof extendedLogger;
export const logger: ExtendedLogger = extendedLogger;

const handleShutdown = (event: string, err?: Error): void => {
  if (err) {
    logger.error(err, `Error during shutdown (${event})`);
  }
  logger.info({ event }, "Process is exiting");

  pinoLogger.flush();
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

type LogLevel = "debug" | "error";

interface LoggerConfig {
  logLevel?: LogLevel;
}

export class Logger {
  private static instance: Logger | undefined;
  private logLevel: LogLevel = "error";

  private constructor() {}

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  configure(config: LoggerConfig): void {
    if (config && config.logLevel !== undefined) {
      this.logLevel = config.logLevel;
    }
  }

  private logger(message: string, level: LogLevel): void {
    if (level === "debug" && this.logLevel !== "debug") {
      return;
    }

    const timestamp = new Date().toISOString();
    const logMessage = `🧱 Formbricks - ${timestamp} [${level.toUpperCase()}] - ${message}`;
    if (level === "error") {
      console.error(logMessage);
    } else {
      console.log(logMessage);
    }
  }

  debug(message: string): void {
    this.logger(message, "debug");
  }

  error(message: string): void {
    this.logger(message, "error");
  }
}

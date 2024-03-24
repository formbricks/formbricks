import pino from "pino";

export const logger = pino({
  level: "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    targets: [
      {
        level: "info",
        target: "pino-pretty",
        options: {
          colorize: true,
          levelFirst: true,
          translateTime: "yyyy-dd-mm, h:MM:ss TT",
        },
      },
    ],
  },
  formatters: {
    bindings: () => ({}),
  },
});

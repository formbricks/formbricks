import { z } from "zod";

export const ZOverallHealthStatus = z
  .object({
    main_database: z
      .boolean()
      .meta({
        example: true,
      })
      .describe("Main database connection status - true if database is reachable and running"),
    cache_database: z
      .boolean()
      .meta({
        example: true,
      })
      .describe("Cache database connection status - true if cache database is reachable and running"),
  })
  .meta({
    title: "Health Check Response",
  })
  .describe("Health check status for critical application dependencies");

export type OverallHealthStatus = z.infer<typeof ZOverallHealthStatus>;

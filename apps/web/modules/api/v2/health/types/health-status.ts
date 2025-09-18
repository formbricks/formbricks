import { z } from "zod";
import { extendZodWithOpenApi } from "zod-openapi";

extendZodWithOpenApi(z);

export const ZOverallHealthStatus = z
  .object({
    main_database: z.boolean().openapi({
      description: "Main database connection status - true if database is reachable and running",
      example: true,
    }),
    cache_database: z.boolean().openapi({
      description: "Cache database connection status - true if cache database is reachable and running",
      example: true,
    }),
  })
  .openapi({
    title: "Health Check Response",
    description: "Health check status for critical application dependencies",
  });

export type OverallHealthStatus = z.infer<typeof ZOverallHealthStatus>;

import { z } from "zod";

/**
 * The public shapes the chart operations answer with, as Zod. The MCP tools advertise them as their
 * `outputSchema`, and the operation tests parse responses through them, so the shape a client is told
 * about and the shape the serializer emits are the same object.
 */

export const ZV3ChartField = z
  .object({
    name: z.string(),
    kind: z.enum(["measure", "dimension", "timeDimension"]),
    type: z.enum(["number", "string", "time", "boolean"]),
    label: z.string(),
    description: z.string().nullable(),
    filterOperators: z.array(z.string()),
    granularities: z.array(z.string()),
    valueLookup: z.boolean(),
  })
  .strict();

export const ZV3ChartFieldCatalog = z
  .object({
    fields: z.array(ZV3ChartField),
    datePresets: z.array(z.string()),
  })
  .strict();

export type TV3ChartFieldCatalog = z.infer<typeof ZV3ChartFieldCatalog>;

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

/** A dashboard holding a chart, as a chart embeds it. */
export const ZV3ChartDashboardRef = z.object({ id: z.string(), name: z.string() }).strict();

export const ZV3ChartResource = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    datasetId: z.string(),
    name: z.string(),
    type: z.enum(["area", "bar", "pie", "big_number", "matrix"]),
    query: z.record(z.string(), z.unknown()),
    config: z.record(z.string(), z.unknown()),
    creator: z.object({ name: z.string() }).strict().nullable(),
    dashboards: z.array(ZV3ChartDashboardRef),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict();

export type TV3ChartResource = z.infer<typeof ZV3ChartResource>;

/** What a chart query returns: the rows a renderer draws, the label maps it reads them with, and the
 * query as it ran (after option grouping and the requested date range). */
export const ZV3ChartData = z
  .object({
    rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))),
    optionLabels: z.record(z.string(), z.string()),
    fieldLabels: z.record(z.string(), z.string()),
    query: z.record(z.string(), z.unknown()),
  })
  .strict();

export type TV3ChartData = z.infer<typeof ZV3ChartData>;

/** One stored value of a field, with the field type when the field is the question label. */
export const ZV3ChartFieldValue = z.object({ value: z.string(), fieldType: z.string().optional() }).strict();

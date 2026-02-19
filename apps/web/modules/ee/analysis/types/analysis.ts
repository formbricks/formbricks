import { z } from "zod";

export const ZChartType = z.enum(["area", "bar", "line", "pie", "big_number"]);
export type TChartType = z.infer<typeof ZChartType>;

import { z } from "zod";

export const ZString = z.string();

export const ZNumber = z.number();

export const ZOptionalNumber = z.number().optional();

export const ZColor = z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);

export const ZBgColor =
  z.string().regex(/storage\/[a-zA-Z0-9]+\/public\/[a-zA-Z0-9%20-]+\.png \d+ [A-Za-z.]+:\d+:\d+/) ||
  z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);

export const ZPlacement = z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]);
export type TPlacement = z.infer<typeof ZPlacement>;

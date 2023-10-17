import { z } from "zod";

export const ZString = z.string();
export const ZNumber = z.number();
export const ZOptionalNumber = z.number().optional();
export const ZColor = z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
export const ZSurveyPlacement = z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]);

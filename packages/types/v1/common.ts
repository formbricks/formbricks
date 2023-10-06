import { z } from "zod";

export const ZColor = z.string().regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/);
export const ZSurveyPlacement = z.enum(["bottomLeft", "bottomRight", "topLeft", "topRight", "center"]);

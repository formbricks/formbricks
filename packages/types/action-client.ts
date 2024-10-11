import { z } from "zod";

export const ZResource = z.enum([
  "product",
  "organization",
  "environment",
  "membership",
  "invite",
  "response",
  "survey",
  "person",
  "tag",
  "responseNote",
  "membership",
  "attributeClass",
  "segment",
  "actionClass",
  "integration",
  "webhook",
  "apiKey",
  "subscription",
  "invite",
  "language",
]);
export type TResource = z.infer<typeof ZResource>;

export const ZOperation = z.enum(["create", "read", "update", "delete"]);
export type TOperation = z.infer<typeof ZOperation>;

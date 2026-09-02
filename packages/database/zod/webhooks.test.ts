import { describe, expect, test } from "vitest";
import { WebhookSource } from "../src/prisma";
import { ZWebhook } from "./webhooks";

describe("ZWebhook", () => {
  // The Zod enum drifted from the Prisma enum once (`activepieces` was missing), which made parsing any
  // ActivePieces webhook row throw at runtime and advertised a wrong enum in the OpenAPI docs. Pin the two
  // together so the next added source fails here instead of in production.
  test("accepts every WebhookSource the database can hold", () => {
    expect([...ZWebhook.shape.source.options].sort()).toEqual(Object.values(WebhookSource).sort());
  });
});

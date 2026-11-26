import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { createAttributeKey, deleteAttributeKey, updateAttributeKey } from "./api-client";

const KEY_ID = "clkey11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const BASE = "/api/internal/contact-attribute-keys";

const key = {
  id: KEY_ID,
  workspaceId: WORKSPACE_ID,
  key: "plan_tier",
  name: "Plan tier",
  description: null,
  type: "custom",
  dataType: "string",
  isUnique: false,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

const sentBody = () => JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));

describe("contact attribute keys API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("POSTs a new key with its workspace", async () => {
    routeFetch({ [`POST ${BASE}`]: [json({ data: key }, 201)] });
    const body = {
      workspaceId: WORKSPACE_ID,
      key: "plan_tier",
      name: "Plan tier",
      dataType: "string" as const,
    };

    expect(await createAttributeKey(body)).toEqual(key);
    expect(sentBody()).toEqual(body);
  });

  test("PATCHes a key's label at its own path, leaving out what isn't set", async () => {
    routeFetch({ [`PATCH ${BASE}/${KEY_ID}`]: [json({ data: { ...key, name: "Tier" } })] });

    await updateAttributeKey(KEY_ID, { name: "Tier", description: undefined });
    expect(sentBody()).toEqual({ name: "Tier" });
  });

  test("DELETEs a key", async () => {
    routeFetch({ [`DELETE ${BASE}/${KEY_ID}`]: [new Response(null, { status: 204 })] });
    await expect(deleteAttributeKey(KEY_ID)).resolves.toBeUndefined();
  });

  test("surfaces the server's reason for a refusal", async () => {
    const detail = "Contacts are not enabled for this organization";
    routeFetch({ [`DELETE ${BASE}/${KEY_ID}`]: [json({ status: 403, detail }, 403)] });

    const failure = deleteAttributeKey(KEY_ID);
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 403, detail });
  });
});

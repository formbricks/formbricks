import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { addResponseTag, createTag, deleteResponse, getResponseCard, removeResponseTag } from "./api-client";

const RESPONSE_ID = "clresp1111111111111111111";
const TAG_ID = "cltag11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const RESPONSES = "/api/internal/responses";
const CREATED_AT = "2026-10-01T10:00:00.000Z";
const UPDATED_AT = "2026-10-02T10:00:00.000Z";

const tag = {
  id: TAG_ID,
  name: "vip",
  workspaceId: WORKSPACE_ID,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
};

const sentRequest = () => vi.mocked(global.fetch).mock.calls[0];

describe("response card API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("reads a response and revives its timestamps, its tags' included", async () => {
    routeFetch({
      [`GET ${RESPONSES}/${RESPONSE_ID}`]: [
        json({
          data: {
            id: RESPONSE_ID,
            createdAt: CREATED_AT,
            updatedAt: UPDATED_AT,
            data: { q1: "Great" },
            tags: [tag],
            quotas: [],
          },
        }),
      ],
    });

    const response = await getResponseCard(RESPONSE_ID);

    expect(response.createdAt).toEqual(new Date(CREATED_AT));
    expect(response.updatedAt).toEqual(new Date(UPDATED_AT));
    expect(response.tags[0].createdAt).toEqual(new Date(CREATED_AT));
    expect(response.tags[0].updatedAt).toEqual(new Date(UPDATED_AT));
    expect(response.data).toEqual({ q1: "Great" });
  });

  test("DELETEs a response, asking for its quota places back only when told to", async () => {
    routeFetch({
      [`DELETE ${RESPONSES}/${RESPONSE_ID}`]: [new Response(null, { status: 204 })],
      [`DELETE ${RESPONSES}/${RESPONSE_ID}?decrementQuotas=true`]: [new Response(null, { status: 204 })],
    });

    await expect(deleteResponse(RESPONSE_ID, { decrementQuotas: false })).resolves.toBeUndefined();
    await expect(deleteResponse(RESPONSE_ID, { decrementQuotas: true })).resolves.toBeUndefined();
    expect(vi.mocked(global.fetch).mock.calls.map(([url]) => url)).toEqual([
      `${RESPONSES}/${RESPONSE_ID}`,
      `${RESPONSES}/${RESPONSE_ID}?decrementQuotas=true`,
    ]);
  });

  test("POSTs a new tag with its workspace", async () => {
    routeFetch({ "POST /api/internal/tags": [json({ data: tag }, 201)] });

    expect(await createTag(WORKSPACE_ID, "vip")).toEqual(tag);
    expect(JSON.parse(String(sentRequest()[1]?.body))).toEqual({ workspaceId: WORKSPACE_ID, name: "vip" });
  });

  test("surfaces a taken tag name as a 409", async () => {
    const detail = "Tag with this name already exists";
    routeFetch({ "POST /api/internal/tags": [json({ status: 409, detail }, 409)] });

    const failure = createTag(WORKSPACE_ID, "vip");
    await expect(failure).rejects.toBeInstanceOf(V3ApiError);
    await expect(failure).rejects.toMatchObject({ status: 409, detail });
  });

  test("PUTs a tag on a response and DELETEs it off again", async () => {
    const path = `${RESPONSES}/${RESPONSE_ID}/tags/${TAG_ID}`;
    routeFetch({
      [`PUT ${path}`]: [json({ data: { responseId: RESPONSE_ID, tagId: TAG_ID } })],
      [`DELETE ${path}`]: [new Response(null, { status: 204 })],
    });

    expect(await addResponseTag(RESPONSE_ID, TAG_ID)).toEqual({ responseId: RESPONSE_ID, tagId: TAG_ID });
    await expect(removeResponseTag(RESPONSE_ID, TAG_ID)).resolves.toBeUndefined();
  });
});

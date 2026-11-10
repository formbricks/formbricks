import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { createActionClass, searchUnsplashPhotos, triggerUnsplashPhotoDownload } from "./api-client";

const WORKSPACE_ID = "clwork1111111111111111111";
const ISO = "2026-10-01T10:00:00.000Z";
const DATE = new Date(ISO);

const sentBody = () => JSON.parse(vi.mocked(global.fetch).mock.calls[0][1]?.body as string);

describe("survey editor API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("creates an action in the workspace named in the query and revives its timestamps", async () => {
    routeFetch({
      [`POST /api/internal/action-classes?workspaceId=${WORKSPACE_ID}`]: [
        json({ data: { id: "clact1", name: "Signed up", createdAt: ISO, updatedAt: ISO } }, 201),
      ],
    });
    const body = {
      name: "Signed up",
      description: null,
      type: "code" as const,
      key: "signed-up",
      workspaceId: WORKSPACE_ID,
    };

    await expect(createActionClass(WORKSPACE_ID, body)).resolves.toMatchObject({
      id: "clact1",
      createdAt: DATE,
      updatedAt: DATE,
    });
    // The workspace travels in the query; the body refuses unknown keys, so the form's copy is dropped.
    const { workspaceId: _workspaceId, ...withoutWorkspace } = body;
    expect(sentBody()).toEqual(withoutWorkspace);
  });

  test("surfaces a refused create as a V3ApiError carrying the server's message", async () => {
    routeFetch({
      [`POST /api/internal/action-classes?workspaceId=${WORKSPACE_ID}`]: [
        json({ status: 409, detail: "Action with name Signed up already exists" }, 409),
      ],
    });

    await expect(
      createActionClass(WORKSPACE_ID, {
        name: "Signed up",
        description: null,
        type: "code",
        key: "signed-up",
        workspaceId: WORKSPACE_ID,
      })
    ).rejects.toMatchObject({ status: 409, detail: "Action with name Signed up already exists" });
  });

  test("searches Unsplash by query and page", async () => {
    const photo = {
      id: "p1",
      alt_description: "a",
      urls: { regularWithAttribution: "https://x", download: "d" },
    };
    routeFetch({ ["GET /api/internal/unsplash-photos?query=red+fox&page=2"]: [json({ data: [photo] })] });

    await expect(searchUnsplashPhotos("red fox", 2)).resolves.toEqual([photo]);
  });

  test("reports a picked photo, and a refusal is an error the caller can ignore", async () => {
    routeFetch({
      ["POST /api/internal/unsplash-photos/downloads"]: [
        new Response(null, { status: 204 }),
        json({ status: 400, detail: "Invalid request body" }, 400),
      ],
    });

    await expect(triggerUnsplashPhotoDownload("https://api.unsplash.com/photos/x/download")).resolves.toBe(
      undefined
    );
    expect(sentBody()).toEqual({ downloadUrl: "https://api.unsplash.com/photos/x/download" });
    await expect(triggerUnsplashPhotoDownload("https://evil.example")).rejects.toBeInstanceOf(V3ApiError);
  });
});

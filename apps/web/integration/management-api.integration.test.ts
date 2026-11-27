import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { GET as getV1Me } from "@/app/api/v1/management/me/route";
import { POST as createV1Response } from "@/app/api/v1/management/responses/route";
import { POST as createV1Survey, GET as listV1Surveys } from "@/app/api/v1/management/surveys/route";
import { DELETE as deleteV1Webhook, GET as getV1Webhook } from "@/app/api/v1/webhooks/[webhookId]/route";
import { POST as createV1Webhook, GET as listV1Webhooks } from "@/app/api/v1/webhooks/route";
import { TApiOwner, callRoute, createOwnerApiKey, seedOwner, signIn } from "@/integration/api-routes";
import { resetDb } from "@/integration/reset-db";
import { POST as createV2Response } from "@/modules/api/v2/management/responses/route";
import {
  DELETE as deleteV2Webhook,
  PUT as updateV2Webhook,
} from "@/modules/api/v2/management/webhooks/[webhookId]/route";
import { POST as createV2Webhook, GET as listV2Webhooks } from "@/modules/api/v2/management/webhooks/route";
import { POST as createV2Contact } from "@/modules/ee/contacts/api/v2/management/contacts/route";

/**
 * Management API journeys against the real Postgres and SpiceDB, with a key minted by the real
 * `createApiKey`. Moved from `playwright/api/management/{contacts,webhook,legacy-environment-id,me}.spec.ts` and
 * `playwright/anonymize-responses.spec.ts` (ENG-7518): none of them needed a page, only an API key, which the browser used to create through the
 * settings dialog.
 */

vi.mock("next/headers", async () => (await import("@/integration/next-headers")).nextHeadersMock);

// The harness runs no BullMQ, and v1 awaits the enqueue that a response create makes. What the pipeline
// does with a response is covered by its own suites, not here.
vi.mock("@/app/lib/pipelines", () => ({ sendToPipeline: vi.fn(async () => undefined) }));

// Contacts is a licensed feature and the harness runs without a license; the gate is not under test here.
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsContactsEnabled: vi.fn(async () => true),
}));

const OPEN_TEXT_QUESTION = {
  id: "jpvm9b73u06xdrhzi11k2h76",
  type: "openText",
  headline: { default: "What would you like to know?" },
  required: true,
  inputType: "text",
  charLimit: { enabled: false },
};

let owner: TApiOwner;
let apiKey: string;

beforeEach(async () => {
  await resetDb();
  owner = await seedOwner();
  apiKey = await createOwnerApiKey(owner);
});

const createSurvey = async (name: string) => {
  const created = await callRoute(createV1Survey, {
    method: "POST",
    path: "/api/v1/management/surveys",
    apiKey,
    body: { workspaceId: owner.workspaceId, type: "link", name, questions: [OPEN_TEXT_QUESTION] },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(200);
  return created.body.data as { id: string; environmentId: string };
};

describe("POST /api/v2/management/contacts", () => {
  const createContact = (attributes: Record<string, string>) =>
    callRoute(createV2Contact, {
      method: "POST",
      path: "/api/v2/management/contacts",
      apiKey,
      body: { workspaceId: owner.workspaceId, attributes },
    });

  test("creates a contact from an email alone, and from several attributes", async () => {
    const emailOnly = await createContact({ email: "single@example.com" });
    expect(emailOnly.status, JSON.stringify(emailOnly.body)).toBe(201);
    expect(emailOnly.body.data).toMatchObject({
      id: expect.stringMatching(/^[a-z0-9]{25}$/),
      workspaceId: owner.workspaceId,
      attributes: { email: "single@example.com" },
      createdAt: expect.any(String),
    });

    const several = await createContact({
      email: "multi@example.com",
      firstName: "John",
      lastName: "Doe",
      userId: "usr_multi",
    });
    expect(several.status).toBe(201);
    expect(several.body.data.attributes).toMatchObject({
      email: "multi@example.com",
      firstName: "John",
      lastName: "Doe",
      userId: "usr_multi",
    });
  });

  test("refuses an attribute key the workspace does not have", async () => {
    const response = await createContact({ email: "newkey@example.com", customAttribute: "custom value" });

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].field).toBe("attributes");
    expect(response.body.error.details[0].issue).toContain("attribute keys not found");
    expect(response.body.error.details[0].issue).toContain("customAttribute");
  });

  test("refuses a second contact with the same email or the same userId", async () => {
    expect((await createContact({ email: "duplicate@example.com" })).status).toBe(201);
    const sameEmail = await createContact({ email: "duplicate@example.com" });
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error.details[0]).toMatchObject({
      field: "email",
      issue: expect.stringContaining("already exists"),
    });

    expect((await createContact({ email: "userid1@example.com", userId: "usr_duplicate" })).status).toBe(201);
    const sameUserId = await createContact({ email: "userid2@example.com", userId: "usr_duplicate" });
    expect(sameUserId.status).toBe(409);
    expect(sameUserId.body.error.details[0]).toMatchObject({
      field: "userId",
      issue: expect.stringContaining("already exists"),
    });
  });
});

describe("/api/v2/management/webhooks", () => {
  test("creates, lists, updates and deletes a webhook", async () => {
    const survey = await createSurvey("Survey for webhooks");

    const created = await callRoute(createV2Webhook, {
      method: "POST",
      path: "/api/v2/management/webhooks",
      apiKey,
      body: {
        workspaceId: owner.workspaceId,
        name: "New Webhook",
        url: "https://example.com/webhook",
        source: "user",
        triggers: ["responseFinished"],
        surveyIds: [survey.id],
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.data.name).toBe("New Webhook");
    const webhookId: string = created.body.data.id;

    const listed = await callRoute(listV2Webhooks, {
      path: "/api/v2/management/webhooks",
      apiKey,
      query: { limit: 10, skip: 0, sortBy: "createdAt", order: "desc" },
    });
    expect(listed.status).toBe(200);
    expect(listed.body.data).toEqual([expect.objectContaining({ id: webhookId, name: "New Webhook" })]);

    const updated = await callRoute(updateV2Webhook, {
      method: "PUT",
      path: `/api/v2/management/webhooks/${webhookId}`,
      params: { webhookId },
      apiKey,
      body: {
        workspaceId: owner.workspaceId,
        name: "Updated Webhook",
        url: "https://example.com/updated-webhook",
        source: "zapier",
        triggers: ["responseCreated"],
        surveyIds: [survey.id],
      },
    });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(updated.body.data).toMatchObject({ name: "Updated Webhook", source: "zapier" });

    const deleted = await callRoute(deleteV2Webhook, {
      method: "DELETE",
      path: `/api/v2/management/webhooks/${webhookId}`,
      params: { webhookId },
      apiKey,
    });
    expect(deleted.status).toBe(200);
  });
});

// ENG-2270: integrations built against API v1 (Zapier, Make, n8n) read `environmentId` off the surveys
// they list and post it back when subscribing a webhook. This walks that exact path so the legacy field
// can't silently disappear from v1 again.
describe("API v1 legacy environmentId", () => {
  test("a Zapier-style webhook subscription round-trips environmentId from the survey list", async () => {
    const survey = await createSurvey("Survey for legacy environmentId");
    expect(survey.environmentId).toBeTruthy();

    const surveys = await callRoute(listV1Surveys, { path: "/api/v1/management/surveys", apiKey });
    expect(surveys.status).toBe(200);
    const listed = surveys.body.data.find((item: { id: string }) => item.id === survey.id);
    expect(listed).toMatchObject({ workspaceId: owner.workspaceId, environmentId: expect.any(String) });
    expect(listed.environmentId).not.toBe("undefined");
    const environmentId: string = listed.environmentId;

    const created = await callRoute(createV1Webhook, {
      method: "POST",
      path: "/api/v1/webhooks",
      apiKey,
      body: {
        environmentId,
        name: "Zapier Response Finished",
        url: "https://example.com/zapier-webhook",
        source: "zapier",
        triggers: ["responseFinished"],
        surveyIds: [survey.id],
      },
    });
    expect(created.status, JSON.stringify(created.body)).toBe(200);
    expect(created.body.data).toMatchObject({ workspaceId: owner.workspaceId, environmentId });
    const webhookId: string = created.body.data.id;

    const webhooks = await callRoute(listV1Webhooks, { path: "/api/v1/webhooks", apiKey });
    expect(webhooks.body.data.find((item: { id: string }) => item.id === webhookId)).toMatchObject({
      environmentId,
    });

    const detail = await callRoute(getV1Webhook, {
      path: `/api/v1/webhooks/${webhookId}`,
      params: { webhookId },
      apiKey,
    });
    expect(detail.status).toBe(200);
    expect(detail.body.data.environmentId).toBe(environmentId);

    const deleted = await callRoute(deleteV1Webhook, {
      method: "DELETE",
      path: `/api/v1/webhooks/${webhookId}`,
      params: { webhookId },
      apiKey,
    });
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.environmentId).toBe(environmentId);
  });
});

describe("GET /api/v1/management/me with a session", () => {
  test("returns the signed-in user and never a secret auth field", async () => {
    const cookie = await signIn(owner);

    const response = await callRoute(getV1Me, { path: "/api/v1/management/me", cookie });

    expect(response.status).toBe(200);
    expect(Object.keys(response.body).sort()).toStrictEqual(
      [
        "id",
        "name",
        "email",
        "emailVerified",
        "createdAt",
        "updatedAt",
        "twoFactorEnabled",
        "identityProvider",
        "notificationSettings",
        "locale",
        "lastLoginAt",
        "isActive",
      ].sort()
    );
    expect(response.body).toMatchObject({
      id: owner.userId,
      name: "owner",
      email: owner.email,
      twoFactorEnabled: expect.any(Boolean),
      identityProvider: expect.any(String),
      notificationSettings: expect.any(Object),
      locale: expect.any(String),
      isActive: expect.any(Boolean),
    });
  });
});

/**
 * The "Anonymize responses" toggle belongs to the survey, not to the door a response came through. Both
 * management response endpoints accept a caller-supplied `meta`, so each needs the policy applied at its
 * own route: there is no shared write seam to put it behind. The realistic caller is a customer proxying
 * submissions from their own backend, which never touches the client routes.
 */
describe("management response creates on an anonymized survey", () => {
  // Everything the policy acts on, in one payload: a `drop` field of each kind, and a url carrying a
  // secret in both the query string and the fragment.
  const sensitiveMeta = {
    source: "link",
    url: "https://example.com/pricing?token=secret#access_token=leak",
    country: "DE",
    userAgent: { browser: "Chrome", os: "macOS", device: "desktop" },
    ipAddress: "203.0.113.7",
  };

  const expectAnonymized = async (responseId: string) => {
    const { meta } = await prisma.response.findUniqueOrThrow({
      where: { id: responseId },
      select: { meta: true },
    });
    // `keep` fields still arrive: the policy suppresses, it does not blank the object.
    expect(meta).toEqual({ source: "link", url: "https://example.com/pricing" });
  };

  test.each([
    ["v2", createV2Response, "/api/v2/management/responses", 201],
    ["v1", createV1Response, "/api/v1/management/responses", 200],
  ] as const)(
    "%s drops the caller-supplied meta the toggle suppresses",
    async (_v, handler, path, status) => {
      const survey = await createSurvey("Anonymized survey from API");
      // Set directly rather than through the create payload: the response routes are under test.
      await prisma.survey.update({ where: { id: survey.id }, data: { isAnonymizeResponsesEnabled: true } });

      const created = await callRoute(handler, {
        method: "POST",
        path,
        apiKey,
        body: {
          workspaceId: owner.workspaceId,
          surveyId: survey.id,
          finished: true,
          data: { [OPEN_TEXT_QUESTION.id]: "Anonymized answer" },
          meta: sensitiveMeta,
        },
      });

      expect(created.status, JSON.stringify(created.body)).toBe(status);
      await expectAnonymized(created.body.data.id);
    }
  );
});

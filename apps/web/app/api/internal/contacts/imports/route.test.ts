import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError, TooManyRequestsError, ValidationError } from "@formbricks/types/errors";
import { V3_REQUEST_ARRAY_MAX_ITEMS } from "@/app/api/v3/lib/array-budget";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  CSV_IMPORT_MAX_BODY_BYTES,
  CSV_IMPORT_MAX_COLUMNS,
  CSV_IMPORT_MAX_KEY_LENGTH,
  CSV_IMPORT_MAX_RECORDS,
  CSV_IMPORT_MAX_VALUE_LENGTH,
} from "@/modules/ee/contacts/lib/csv-import-limits";
import { POST as createPersonalLink } from "../[contactId]/personal-links/route";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  capturePostHogEvent: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  createContactsFromCSV: vi.fn(),
  contactCount: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({ prisma: { contact: { count: mocks.contactCount } } }));
vi.mock("@/lib/authorization", () => ({ can: mocks.can, assertCan: vi.fn() }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
  getOrganizationIdFromContactId: vi.fn(),
  getWorkspaceIdFromContactId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.getIsContactsEnabled }));
vi.mock("@/modules/ee/contacts/lib/contacts", () => ({
  createContactsFromCSV: mocks.createContactsFromCSV,
  deleteContact: vi.fn(),
  getContact: vi.fn(),
}));
vi.mock("@/modules/ee/contacts/lib/update-contact-attributes", () => ({ updateContactAttributes: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-survey-link", () => ({ getContactSurveyLink: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    targetId: "unknown",
    organizationId: "unknown",
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const URL = `http://localhost/api/internal/contacts/imports?workspaceId=${WORKSPACE_ID}`;

type TBody = {
  csvData: Record<string, string>[];
  duplicateContactsAction: string;
  attributeMap: Record<string, string>;
};

const records = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ email: `user${i}@example.com` }));
const body = (overrides: Partial<TBody> = {}): TBody => ({
  csvData: [{ email: "ada@example.com", plan: "pro" }],
  duplicateContactsAction: "skip",
  attributeMap: { email: "email", plan: "plan" },
  ...overrides,
});

const post = (
  payload: unknown,
  { url = URL, headers = SAME_ORIGIN_HEADERS }: { url?: string; headers?: Record<string, string> } = {}
) =>
  POST(
    new NextRequest(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof payload === "string" ? payload : JSON.stringify(payload),
    }),
    {} as never
  );

const problem = async (response: Response) =>
  (await response.json()) as { detail: string; invalid_params?: { name: string; reason: string }[] };

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);
const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

const importedContacts = [
  { id: "clcontact1111111111111111", workspaceId: WORKSPACE_ID, attributes: [] },
  { id: "clcontact2222222222222222", workspaceId: WORKSPACE_ID, attributes: [] },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getIsContactsEnabled.mockResolvedValue(true);
  mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
  mocks.contactCount.mockResolvedValue(40);
  mocks.createContactsFromCSV.mockResolvedValue({ contacts: importedContacts });
});

describe("POST /api/internal/contacts/imports: authorization, in the action's order", () => {
  test("authorizes a write on the workspace, then charges its budget, then checks the licence", async () => {
    const response = await post(body());

    expect(response.status).toBe(200);
    expect(checkedActions()).toEqual([["workspace.write", { type: "workspace", id: WORKSPACE_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.getIsContactsEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.applyRateLimit.mock.invocationCallOrder.at(-1)).toBeLessThan(
      mocks.getIsContactsEnabled.mock.invocationCallOrder[0]
    );
    expect(mocks.can.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.applyRateLimit.mock.invocationCallOrder.at(-1) as number
    );
  });

  test("answers the uniform 403 to a caller who can't write the workspace, before the budget and licence", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await post(body());

    expect(response.status).toBe(403);
    expect((await problem(response)).detail).toBe("You are not authorized to access this resource");
    expect(operationLimits()).toEqual([]);
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.createContactsFromCSV).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a workspace that doesn't exist", async () => {
    mocks.getOrganizationIdFromWorkspaceId.mockRejectedValue(
      new ResourceNotFoundError("workspace", WORKSPACE_ID)
    );

    const response = await post(body());

    expect(response.status).toBe(403);
    expect((await problem(response)).detail).toBe("You are not authorized to access this resource");
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.createContactsFromCSV).not.toHaveBeenCalled();
  });

  test("answers 429 when the workspace's write budget is spent, before the licence", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    expect((await post(body())).status).toBe(429);
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.createContactsFromCSV).not.toHaveBeenCalled();
  });

  test("answers 403 with the licence message when Contacts aren't enabled", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const response = await post(body());

    expect(response.status).toBe(403);
    expect((await problem(response)).detail).toBe("Contacts are not enabled for this organization");
    expect(mocks.createContactsFromCSV).not.toHaveBeenCalled();
  });

  test("audits a refusal as a failure on the workspace's organization, as the action did", async () => {
    mocks.can.mockResolvedValue(false);

    await post(body());

    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "createdFromCSV",
        targetType: "contact",
        organizationId: ORG_ID,
        status: "failure",
      })
    );
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await post(body(), { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.createContactsFromCSV).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await post(body())).status).toBe(401);
  });
});

describe("POST /api/internal/contacts/imports: the import", () => {
  test("imports the records, answers the contacts' ids, audits them and captures contact_created", async () => {
    const sent = body({ duplicateContactsAction: "update" });

    const response = await post(sent);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { contacts: importedContacts.map(({ id }) => ({ id })) },
    });
    expect(mocks.createContactsFromCSV).toHaveBeenCalledWith(
      sent.csvData,
      WORKSPACE_ID,
      "update",
      sent.attributeMap
    );
    expect(mocks.contactCount).toHaveBeenCalledWith({ where: { workspaceId: WORKSPACE_ID } });
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "createdFromCSV",
        targetType: "contact",
        targetId: "unknown",
        organizationId: ORG_ID,
        status: "success",
        newObject: { contacts: importedContacts },
      })
    );
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "contact_created",
      {
        organization_id: ORG_ID,
        workspace_id: WORKSPACE_ID,
        existing_contact_count: 40,
        creation_method: "import",
        import_count: 2,
      },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("answers values that don't fit their attribute's type as validationErrors, with no event", async () => {
    const validationErrors = [{ key: "age", dataType: "number", invalidValues: ["old"] }];
    mocks.createContactsFromCSV.mockResolvedValue({ validationErrors });

    const response = await post(body());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { validationErrors } });
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
    const [[event]] = mocks.queueAuditEvent.mock.calls;
    expect(event).toMatchObject({ action: "createdFromCSV", status: "success" });
    expect(event.newObject).toBeUndefined();
  });

  test("answers the import's own refusal (the attribute key cap) as a 422 with its message", async () => {
    const message = "Importing these contacts adds 6 attribute keys, past the 150 a workspace can have";
    mocks.createContactsFromCSV.mockRejectedValue(new ValidationError(message));

    const response = await post(body());

    expect(response.status).toBe(422);
    expect((await problem(response)).detail).toBe(message);
    expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
  });

  test("lets any other failure through as a 500 without its message", async () => {
    mocks.createContactsFromCSV.mockRejectedValue(new Error("connection reset"));

    const response = await post(body());

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("connection reset");
  });
});

describe("POST /api/internal/contacts/imports: per-record validation", () => {
  test.each([
    ["a record without an email", [{ plan: "pro" }], "Missing email field for one or more records"],
    ["an empty email", [{ email: "" }], "Email field is empty for one or more records"],
    [
      "a repeated email",
      [{ email: "ada@example.com" }, { email: "ada@example.com" }],
      "Duplicate emails found in the records",
    ],
    [
      "a repeated userId",
      [
        { email: "ada@example.com", userId: "u1" },
        { email: "bob@example.com", userId: "u1" },
      ],
      "Duplicate userIds found in the records",
    ],
  ])("refuses %s with 400", async (_label, csvData, reason) => {
    const response = await post(body({ csvData }));

    expect(response.status).toBe(400);
    expect((await problem(response)).invalid_params).toEqual([
      expect.objectContaining({ name: "csvData", reason }),
    ]);
    expect(mocks.createContactsFromCSV).not.toHaveBeenCalled();
  });

  test("refuses an attribute mapped twice", async () => {
    const response = await post(body({ attributeMap: { email: "email", mail: "email" } }));

    expect(response.status).toBe(400);
    expect((await problem(response)).invalid_params).toEqual([
      expect.objectContaining({ name: "attributeMap", reason: "Attribute map contains duplicate values" }),
    ]);
  });

  test.each([
    ["an unknown body key", body({ ...{ extra: "x" } } as Partial<TBody>), URL],
    ["an unknown duplicate action", body({ duplicateContactsAction: "merge" }), URL],
    ["an unknown query key", body(), `${URL}&extra=1`],
    ["no workspace", body(), "http://localhost/api/internal/contacts/imports"],
  ])("refuses %s with 400", async (_label, payload, url) => {
    expect((await post(payload, { url })).status).toBe(400);
    expect(mocks.createContactsFromCSV).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/contacts/imports: caps, at and just past each", () => {
  /** A record of `count` columns, the email among them. */
  const recordWithColumns = (count: number) => ({
    email: "ada@example.com",
    ...Object.fromEntries(Array.from({ length: count - 1 }, (_, i) => [`column_${i}`, "x"])),
  });
  /** An attribute map of `count` entries with distinct values. */
  const mapOfEntries = (count: number) =>
    Object.fromEntries(Array.from({ length: count }, (_, i) => [`column_${i}`, `attribute_${i}`]));

  const expectAccepted = async (payload: unknown) => {
    const response = await post(payload);
    expect(response.status).toBe(200);
  };
  const expectRefused = async (payload: unknown, name: string, reason: string, status = 400) => {
    const response = await post(payload);
    expect(response.status).toBe(status);
    expect((await problem(response)).invalid_params).toEqual([expect.objectContaining({ name, reason })]);
  };

  test(`records: takes ${CSV_IMPORT_MAX_RECORDS}, past the default budget, and refuses one more`, async () => {
    await expectAccepted(body({ csvData: records(CSV_IMPORT_MAX_RECORDS) }));
    expect(mocks.createContactsFromCSV.mock.calls[0][0]).toHaveLength(CSV_IMPORT_MAX_RECORDS);

    await expectRefused(
      body({ csvData: records(CSV_IMPORT_MAX_RECORDS + 1) }),
      "csvData",
      `Too big: expected array to have <=${CSV_IMPORT_MAX_RECORDS} items`
    );
    expect(mocks.createContactsFromCSV).toHaveBeenCalledTimes(1);
  });

  test("the lifted array budget is this route's only: another contacts route keeps the default", async () => {
    const response = await createPersonalLink(
      new NextRequest("http://localhost/api/internal/contacts/clcontact1111111111111111/personal-links", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS },
        body: JSON.stringify({
          surveyId: "clsurvey11111111111111111",
          padding: records(V3_REQUEST_ARRAY_MAX_ITEMS + 1),
        }),
      }),
      { params: Promise.resolve({ contactId: "clcontact1111111111111111" }) } as never
    );

    expect(response.status).toBe(400);
    expect((await problem(response)).invalid_params).toEqual([
      { name: "padding", reason: `Too big: expected array to have <=${V3_REQUEST_ARRAY_MAX_ITEMS} items` },
    ]);
  });

  test(`columns per record: takes ${CSV_IMPORT_MAX_COLUMNS} and refuses one more`, async () => {
    await expectAccepted(body({ csvData: [recordWithColumns(CSV_IMPORT_MAX_COLUMNS)], attributeMap: {} }));
    await expectRefused(
      body({ csvData: [recordWithColumns(CSV_IMPORT_MAX_COLUMNS + 1)], attributeMap: {} }),
      "csvData.0",
      `A record may have at most ${CSV_IMPORT_MAX_COLUMNS} entries (record 1)`
    );
  });

  test(`column names: take ${CSV_IMPORT_MAX_KEY_LENGTH} characters and refuse one more`, async () => {
    const withKey = (length: number) => [{ email: "ada@example.com", ["k".repeat(length)]: "x" }];
    await expectAccepted(body({ csvData: withKey(CSV_IMPORT_MAX_KEY_LENGTH), attributeMap: {} }));
    await expectRefused(
      body({ csvData: withKey(CSV_IMPORT_MAX_KEY_LENGTH + 1), attributeMap: {} }),
      "csvData.0",
      `A column name must be at most ${CSV_IMPORT_MAX_KEY_LENGTH} characters (record 1)`
    );
  });

  test(`values: take ${CSV_IMPORT_MAX_VALUE_LENGTH} characters and refuse one more`, async () => {
    const withValue = (length: number) => [{ email: "ada@example.com", note: "v".repeat(length) }];
    await expectAccepted(body({ csvData: withValue(CSV_IMPORT_MAX_VALUE_LENGTH), attributeMap: {} }));
    await expectRefused(
      body({ csvData: withValue(CSV_IMPORT_MAX_VALUE_LENGTH + 1), attributeMap: {} }),
      "csvData.0",
      `A value must be at most ${CSV_IMPORT_MAX_VALUE_LENGTH} characters (record 1)`
    );
  });

  test.each([
    [
      "a value",
      [{ email: "ada@example.com", note: "a\u0000b" }],
      "A value must not contain NUL characters (record 1)",
    ],
    [
      "a column name",
      [{ email: "ada@example.com", "no\u0000te": "x" }],
      "A column name must not contain NUL characters (record 1)",
    ],
  ])("refuses NUL in %s", async (_label, csvData, reason) => {
    await expectRefused(body({ csvData, attributeMap: {} }), "csvData.0", reason);
  });

  test(`attribute map entries: takes ${CSV_IMPORT_MAX_COLUMNS} and refuses one more`, async () => {
    await expectAccepted(body({ attributeMap: mapOfEntries(CSV_IMPORT_MAX_COLUMNS) }));
    await expectRefused(
      body({ attributeMap: mapOfEntries(CSV_IMPORT_MAX_COLUMNS + 1) }),
      "attributeMap",
      `The attribute map may have at most ${CSV_IMPORT_MAX_COLUMNS} entries`
    );
  });

  test(`attribute map keys and values: take ${CSV_IMPORT_MAX_KEY_LENGTH} characters and refuse one more`, async () => {
    const at = "a".repeat(CSV_IMPORT_MAX_KEY_LENGTH);
    const past = "a".repeat(CSV_IMPORT_MAX_KEY_LENGTH + 1);

    await expectAccepted(body({ attributeMap: { [at]: at } }));
    await expectRefused(
      body({ attributeMap: { [past]: "plan" } }),
      "attributeMap",
      `A column name must be at most ${CSV_IMPORT_MAX_KEY_LENGTH} characters`
    );
    await expectRefused(
      body({ attributeMap: { plan: past } }),
      "attributeMap",
      `A mapped attribute must be at most ${CSV_IMPORT_MAX_KEY_LENGTH} characters`
    );
    await expectRefused(
      body({ attributeMap: { plan: "pl\u0000an" } }),
      "attributeMap",
      "A mapped attribute must not contain NUL characters"
    );
  });

  test(`body: takes ${CSV_IMPORT_MAX_BODY_BYTES} bytes and answers 413 to one more`, async () => {
    /** A valid import body of exactly `bytes` bytes: full-length notes, the remainder padding one email. */
    const bodyOfBytes = (bytes: number) => {
      const payload = body({ csvData: [], attributeMap: {} });
      const size = () => Buffer.byteLength(JSON.stringify(payload));
      const fullRecord = (i: number) => ({
        email: `u${i}@example.com`,
        note: "n".repeat(CSV_IMPORT_MAX_VALUE_LENGTH),
      });
      while (size() + Buffer.byteLength(JSON.stringify(fullRecord(payload.csvData.length))) + 1 <= bytes) {
        payload.csvData.push(fullRecord(payload.csvData.length));
      }
      // What is left is less than a full record: a shorter one takes it, or, if even an empty-noted record
      // is too long, the first email does.
      const last = { email: `u${payload.csvData.length}@example.com`, note: "" };
      const lastSize = Buffer.byteLength(JSON.stringify(last)) + 1;
      if (size() + lastSize <= bytes) {
        last.note = "n".repeat(bytes - size() - lastSize);
        payload.csvData.push(last);
      }
      const first = payload.csvData[0];
      first.email = `${"p".repeat(bytes - size())}${first.email}`;
      const text = JSON.stringify(payload);
      expect(Buffer.byteLength(text)).toBe(bytes);
      return text;
    };

    await expectAccepted(bodyOfBytes(CSV_IMPORT_MAX_BODY_BYTES));

    const response = await post(bodyOfBytes(CSV_IMPORT_MAX_BODY_BYTES + 1));
    expect(response.status).toBe(413);
    expect(mocks.createContactsFromCSV).toHaveBeenCalledTimes(1);
  });
});

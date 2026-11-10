import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ValidationError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import {
  NO_CONTACTS_IN_SEGMENT_ERROR_CODE,
  SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE,
  SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE,
} from "@/modules/ee/contacts/lib/personal-link-errors";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getOrganizationIdFromSurveyId: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  getIsContactsEnabled: vi.fn(),
  resolveSurveyActorContext: vi.fn(),
  generatePersonalLinks: vi.fn(),
  capturePostHogEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/utils/helper", () => ({
  getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId,
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.getIsContactsEnabled }));
vi.mock("@/lib/survey/visibility/actor-context", () => ({
  resolveSurveyActorContext: mocks.resolveSurveyActorContext,
}));
vi.mock("@/modules/ee/contacts/lib/contacts", () => ({ generatePersonalLinks: mocks.generatePersonalLinks }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const SEGMENT_ID = "clsegment1111111111111111";
const memberActor = { enforced: true, isOrganizationAdmin: false, kind: "user", userId: USER_ID };

const generate = (body: unknown = { segmentId: SEGMENT_ID, expirationDays: 7 }) =>
  POST(
    new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/personal-links`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getOrganizationIdFromSurveyId.mockResolvedValue(ORG_ID);
  mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(WORKSPACE_ID);
  mocks.getIsContactsEnabled.mockResolvedValue(true);
  mocks.resolveSurveyActorContext.mockResolvedValue(memberActor);
  mocks.generatePersonalLinks.mockResolvedValue([
    {
      contactId: "contact1",
      attributes: { userId: "u1", firstName: "Ada", lastName: "Lovelace", email: "ada@example.com" },
      surveyUrl: "https://f.test/c/token1",
    },
    { contactId: "contact2", attributes: { email: "=HYPERLINK()" }, surveyUrl: "https://f.test/c/token2" },
  ]);
});

describe("POST /api/internal/surveys/{surveyId}/personal-links", () => {
  test("answers a CSV of the segment's links, evaluated as the signed-in user, and records it", async () => {
    const response = await generate();

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.fileName).toMatch(new RegExp(`^personal-links-${SURVEY_ID}-\\d+\\.csv$`));
    const [header, first, second] = data.csvContent.split("\n");
    expect(header).toBe('"Formbricks Contact ID","User ID","First Name","Last Name","Email","Personal Link"');
    expect(first).toBe('"contact1","u1","Ada","Lovelace","ada@example.com","https://f.test/c/token1"');
    // Spreadsheet formulas never evaluate.
    expect(second).toBe(`"contact2","","","","'=HYPERLINK()","https://f.test/c/token2"`);

    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "survey.write", {
      type: "survey",
      id: SURVEY_ID,
    });
    // ENG-6870: the segment's filters are evaluated with the caller's survey visibility.
    expect(mocks.resolveSurveyActorContext).toHaveBeenCalledWith({ type: "user", id: USER_ID }, ORG_ID);
    expect(mocks.generatePersonalLinks).toHaveBeenCalledWith(SURVEY_ID, SEGMENT_ID, memberActor, 7);
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "personal_link_created",
      { organization_id: ORG_ID, workspace_id: WORKSPACE_ID, survey_id: SURVEY_ID, link_count: 2 },
      { organizationId: ORG_ID, workspaceId: WORKSPACE_ID }
    );
  });

  test("makes links that don't expire when no expiry is sent", async () => {
    await generate({ segmentId: SEGMENT_ID });
    expect(mocks.generatePersonalLinks).toHaveBeenCalledWith(SURVEY_ID, SEGMENT_ID, memberActor, undefined);
  });

  test("refuses where Contacts isn't licensed, with the reason, once the caller may edit the survey", async () => {
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const response = await generate();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Contacts are not enabled for this workspace");
    expect(mocks.can).toHaveBeenCalled();
    expect(mocks.generatePersonalLinks).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 to a caller who can't edit the survey, before the licence is asked", async () => {
    mocks.can.mockResolvedValue(false);
    mocks.getIsContactsEnabled.mockResolvedValue(false);

    const response = await generate();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.getIsContactsEnabled).not.toHaveBeenCalled();
    expect(mocks.generatePersonalLinks).not.toHaveBeenCalled();
  });

  test.each([
    ["a fractional number of days", 1.5],
    ["zero days", 0],
    ["more than a century", 36_501],
  ])("answers 400 for %s", async (_label, expirationDays) => {
    expect((await generate({ segmentId: SEGMENT_ID, expirationDays })).status).toBe(400);
    expect(mocks.generatePersonalLinks).not.toHaveBeenCalled();
  });

  test.each([SEGMENT_SURVEY_WORKSPACE_MISMATCH_ERROR_CODE, SEGMENT_SURVEY_FILTERS_NOT_VISIBLE_ERROR_CODE])(
    "answers 422 with the code %s the tab translates",
    async (code) => {
      mocks.generatePersonalLinks.mockRejectedValue(new ValidationError(code));

      const response = await generate();

      expect(response.status).toBe(422);
      expect((await response.json()).detail).toBe(code);
      expect(mocks.capturePostHogEvent).not.toHaveBeenCalled();
    }
  );

  test.each([
    ["no contacts", []],
    ["a segment or survey that is gone", null],
  ])("answers 422 with the no-contacts code for %s", async (_label, result) => {
    mocks.generatePersonalLinks.mockResolvedValue(result);

    const response = await generate();

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe(NO_CONTACTS_IN_SEGMENT_ERROR_CODE);
  });

  test.each([
    ["no segment", {}],
    ["a segment that isn't an id", { segmentId: "segment-1" }],
    ["an expiry that isn't a number", { segmentId: SEGMENT_ID, expirationDays: "7" }],
    ["an unknown key", { segmentId: SEGMENT_ID, surveyId: SURVEY_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await generate(body)).status).toBe(400);
    expect(mocks.generatePersonalLinks).not.toHaveBeenCalled();
  });
});

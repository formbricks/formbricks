import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { jsonResponse as json, routeFetch } from "@/modules/api/lib/hook-test-utils";
import { V3ApiError, getV3ApiErrorMessage } from "@/modules/api/lib/v3-client";
import {
  createContactPersonalLink,
  deleteContact,
  importContacts,
  updateContactAttributes,
} from "./api-client";

const CONTACT_ID = "clcontact1111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const BASE = `/api/internal/contacts/${CONTACT_ID}`;

const sentBody = () => JSON.parse(String(vi.mocked(global.fetch).mock.calls[0][1]?.body));

describe("contacts API client", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("DELETEs a contact", async () => {
    routeFetch({ [`DELETE ${BASE}`]: [new Response(null, { status: 204 })] });
    await expect(deleteContact(CONTACT_ID)).resolves.toBeUndefined();
  });

  test("PUTs the attributes, answering the save's messages", async () => {
    const messages = [{ code: "email_already_exists", params: {} }];
    routeFetch({ [`PUT ${BASE}/attributes`]: [json({ data: { contactId: CONTACT_ID, messages } })] });

    expect(await updateContactAttributes(CONTACT_ID, { email: "ada@example.com", seats: 3 })).toEqual({
      contactId: CONTACT_ID,
      messages,
    });
    expect(sentBody()).toEqual({ attributes: { email: "ada@example.com", seats: 3 } });
  });

  test("POSTs the survey for a personal link", async () => {
    routeFetch({ [`POST ${BASE}/personal-links`]: [json({ data: { surveyUrl: "https://f.test/c/t" } })] });

    expect(await createContactPersonalLink(CONTACT_ID, SURVEY_ID)).toEqual({
      surveyUrl: "https://f.test/c/t",
    });
    expect(sentBody()).toEqual({ surveyId: SURVEY_ID });
  });

  describe("importContacts", () => {
    const WORKSPACE_ID = "clwork1111111111111111111";
    const IMPORTS = `/api/internal/contacts/imports?workspaceId=${WORKSPACE_ID}`;
    const importBody = {
      csvData: [{ email: "ada@example.com", plan: "pro" }],
      duplicateContactsAction: "skip" as const,
      attributeMap: { email: "email", plan: "plan" },
    };

    test("POSTs the import to the workspace's imports, with no timeout, and answers the result", async () => {
      routeFetch({ [`POST ${IMPORTS}`]: [json({ data: { contacts: [{ id: "c1" }] } })] });

      expect(await importContacts(WORKSPACE_ID, importBody)).toEqual({ contacts: [{ id: "c1" }] });
      expect(sentBody()).toEqual(importBody);
      // A large import runs long: nothing aborts it client-side.
      expect(vi.mocked(global.fetch).mock.calls[0][1]?.signal).toBeUndefined();
    });

    test("answers type mismatches as data", async () => {
      const validationErrors = [{ key: "age", dataType: "number", invalidValues: ["old"] }];
      routeFetch({ [`POST ${IMPORTS}`]: [json({ data: { validationErrors } })] });

      expect(await importContacts(WORKSPACE_ID, importBody)).toEqual({ validationErrors });
    });

    test("a refused cap reads as its reason", async () => {
      const reason = "A value must be at most 10000 characters (record 3)";
      routeFetch({
        [`POST ${IMPORTS}`]: [
          json(
            {
              status: 400,
              detail: "Invalid request body",
              code: "bad_request",
              invalid_params: [{ name: "csvData.2", reason }],
            },
            400
          ),
        ],
      });

      const error = await importContacts(WORKSPACE_ID, importBody).catch((caught: unknown) => caught);
      expect(getV3ApiErrorMessage(error, "fallback")).toBe(reason);
    });
  });

  test("surfaces a refusal's code as the error's message", async () => {
    const detail = "contact_survey_workspace_mismatch";
    routeFetch({ [`POST ${BASE}/personal-links`]: [json({ status: 422, detail }, 422)] });

    const error = await createContactPersonalLink(CONTACT_ID, SURVEY_ID).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(V3ApiError);
    expect((error as V3ApiError).message).toBe(detail);
  });
});

import {
  organizationBilling,
  organizationId,
  response,
  responseFilter,
  responseInput,
  responseInputNotFinished,
  responseInputWithoutDisplay,
  responseInputWithoutTtc,
  workspaceId,
} from "./__mocks__/response.mock";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { err, ok } from "@formbricks/types/error-handlers";
import { getContactByUserId } from "@/modules/api/v2/management/responses/lib/contact";
import {
  getOrganizationBilling,
  getOrganizationIdFromWorkspaceId,
} from "@/modules/api/v2/management/responses/lib/organization";
import type { ApiErrorResponseV2 } from "@/modules/api/v2/types/api-error";
import {
  evaluateResponseQuotas,
  loadQuotaEvaluationContext,
} from "@/modules/ee/quotas/lib/evaluation-service";
import {
  type TCreateResponseContext,
  createResponse,
  createResponseWithQuotaEvaluation,
  getResponses,
  resolveCreateResponseContext,
} from "../response";

vi.mock("@/modules/api/v2/management/responses/lib/organization", () => ({
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getOrganizationBilling: vi.fn(),
}));

vi.mock("@/modules/api/v2/management/responses/lib/contact", () => ({
  getContactByUserId: vi.fn(),
}));

vi.mock("@/modules/ee/quotas/lib/evaluation-service", () => ({
  evaluateResponseQuotas: vi.fn(),
  loadQuotaEvaluationContext: vi.fn(),
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    response: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    // createResponse checks that a caller-supplied displayId belongs to the survey before connecting it.
    display: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/constants", async () => {
  const actual = await vi.importActual<typeof import("@/lib/constants")>("@/lib/constants");
  return {
    ...actual,
    IS_PRODUCTION: false,
    ENCRYPTION_KEY: "test",
  };
});

describe("Response Lib", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: the display named by the fixtures belongs to the survey under test.
    vi.mocked(prisma.display.findUnique).mockResolvedValue({
      surveyId: responseInput.surveyId,
    } as never);
  });

  describe("createResponse", () => {
    // The reads `resolveCreateResponseContext` makes before the transaction, all succeeding.
    const resolvedContext: TCreateResponseContext = { contact: ok(null), organization: ok(organizationId) };
    const organizationNotFound: TCreateResponseContext["organization"] = err({
      type: "not_found",
      details: [{ field: "organization", issue: "not found" }],
    });
    const contactLookupFailed: TCreateResponseContext["contact"] = err({
      type: "internal_server_error",
      details: [{ field: "contact", issue: "DB error" }],
    });

    // Regression: displayId was connected with no ownership check, and Display<->Response is 1:1, so
    // naming another workspace's display moved it onto this response and corrupted that tenant's counts.
    test("reject a displayId that belongs to a different survey", async () => {
      vi.mocked(prisma.display.findUnique).mockResolvedValue({
        surveyId: "someothersurveyid00000000",
      } as never);

      const result = await createResponse(responseInput, resolvedContext);

      expect(result.ok).toBe(false);
      expect(prisma.response.create).not.toHaveBeenCalled();
    });

    test("reject a displayId that does not exist", async () => {
      vi.mocked(prisma.display.findUnique).mockResolvedValue(null as never);

      const result = await createResponse(responseInput, resolvedContext);

      expect(result.ok).toBe(false);
      expect(prisma.response.create).not.toHaveBeenCalled();
    });

    // The anti-enumeration property, not just the rejection: a foreign display and a nonexistent one
    // must be indistinguishable, or the endpoint confirms which display ids are real. Asserted as one
    // test comparing the two errors so a future edit cannot make only one of them more specific.
    test("report a foreign and a nonexistent displayId identically", async () => {
      vi.mocked(prisma.display.findUnique).mockResolvedValue({
        surveyId: "someothersurveyid00000000",
      } as never);
      const foreign = await createResponse(responseInput, resolvedContext);

      vi.mocked(prisma.display.findUnique).mockResolvedValue(null as never);
      const missing = await createResponse(responseInput, resolvedContext);

      expect(foreign.ok).toBe(false);
      expect(missing.ok).toBe(false);
      if (!foreign.ok && !missing.ok) {
        expect(foreign.error).toEqual({
          type: "not_found",
          details: [{ field: "display", issue: "not found" }],
        });
        expect(missing.error).toEqual(foreign.error);
      }
    });

    test.each([
      ["a full input", responseInput],
      ["initialTtc not finished", responseInputNotFinished],
      ["initialTtc not provided", responseInputWithoutTtc],
      ["display not provided", responseInputWithoutDisplay],
    ])("create a response successfully for %s", async (_label, input) => {
      vi.mocked(prisma.response.create).mockResolvedValue(response);

      const result = await createResponse(input, resolvedContext);

      expect(prisma.response.create).toHaveBeenCalled();
      expect(result).toEqual(ok(response));
    });

    test("link the resolved contact and snapshot its attributes", async () => {
      vi.mocked(prisma.response.create).mockResolvedValue(response);
      const contact = { id: "contactid0000000000000000", attributes: { userId: "user-1" } };

      await createResponse(responseInput, { ...resolvedContext, contact: ok(contact) });

      expect(prisma.response.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contact: { connect: { id: contact.id } },
          contactAttributes: contact.attributes,
        }),
      });
    });

    // The reads happen before the transaction now, but their failures are still reported in the order
    // they always were: display, then contact, then organization.
    test("report a display failure ahead of contact and organization failures", async () => {
      vi.mocked(prisma.display.findUnique).mockResolvedValue(null as never);

      const result = await createResponse(responseInput, {
        contact: contactLookupFailed,
        organization: organizationNotFound,
      });

      expect(result).toEqual(err({ type: "not_found", details: [{ field: "display", issue: "not found" }] }));
    });

    test("report a contact failure ahead of an organization failure", async () => {
      const result = await createResponse(responseInput, {
        contact: contactLookupFailed,
        organization: organizationNotFound,
      });

      expect(result).toEqual(contactLookupFailed);
      expect(prisma.response.create).not.toHaveBeenCalled();
    });

    test("report an organization failure without creating", async () => {
      const result = await createResponse(responseInput, {
        ...resolvedContext,
        organization: organizationNotFound,
      });

      expect(result).toEqual(organizationNotFound);
      expect(prisma.response.create).not.toHaveBeenCalled();
    });

    test("return an internal_server_error error if prisma create fails", async () => {
      vi.mocked(prisma.response.create).mockRejectedValue(new Error("Internal server error"));

      const result = await createResponse(responseInput, resolvedContext);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.type).toEqual("internal_server_error");
      }
    });
  });

  describe("resolveCreateResponseContext", () => {
    const notFound: ApiErrorResponseV2 = {
      type: "not_found",
      details: [{ field: "organization", issue: "not found" }],
    };

    test("resolves the organization, and no contact without a userId", async () => {
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(ok(organizationId));
      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));

      await expect(resolveCreateResponseContext(workspaceId, undefined)).resolves.toEqual({
        contact: ok(null),
        organization: ok(organizationId),
      });
      expect(getContactByUserId).not.toHaveBeenCalled();
    });

    test("resolves the contact by userId when one is given", async () => {
      const contact = { id: "contactid0000000000000000", attributes: { userId: "user-1" } };
      vi.mocked(getContactByUserId).mockResolvedValue(ok(contact));
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(ok(organizationId));
      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));

      const context = await resolveCreateResponseContext(workspaceId, "user-1");

      expect(getContactByUserId).toHaveBeenCalledWith(workspaceId, "user-1");
      expect(context.contact).toEqual(ok(contact));
    });

    test("carries a missing organization as a failed result", async () => {
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(err(notFound));

      const context = await resolveCreateResponseContext(workspaceId, undefined);

      expect(context.organization).toEqual(err(notFound));
      expect(getOrganizationBilling).not.toHaveBeenCalled();
    });

    test("carries a missing billing row as a failed result", async () => {
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(ok(organizationId));
      vi.mocked(getOrganizationBilling).mockResolvedValue(err(notFound));

      const context = await resolveCreateResponseContext(workspaceId, undefined);

      expect(context.organization).toEqual(err(notFound));
    });
  });

  describe("createResponseWithQuotaEvaluation", () => {
    test("reads the quota definitions, organization and contact before opening the transaction", async () => {
      const quotaContext = { quotas: [], survey: { id: responseInput.surveyId } } as never;
      const contact = { id: "contactid0000000000000000", attributes: { userId: "user-1" } };
      vi.mocked(loadQuotaEvaluationContext).mockResolvedValue(quotaContext);
      vi.mocked(evaluateResponseQuotas).mockResolvedValue({ shouldEndSurvey: false });
      vi.mocked(prisma.$transaction).mockImplementation((async (cb: (tx: typeof prisma) => unknown) =>
        cb(prisma)) as never);
      vi.mocked(prisma.response.create).mockResolvedValue(response);
      vi.mocked(getContactByUserId).mockResolvedValue(ok(contact));
      vi.mocked(getOrganizationIdFromWorkspaceId).mockResolvedValue(ok(organizationId));
      vi.mocked(getOrganizationBilling).mockResolvedValue(ok(organizationBilling));

      const result = await createResponseWithQuotaEvaluation(workspaceId, {
        ...responseInput,
        userId: "user-1",
      });

      expect(result.ok).toBe(true);
      expect(loadQuotaEvaluationContext).toHaveBeenCalledWith(responseInput.surveyId);
      // ENG-3285 / ENG-3722: every root-client read happens before the transaction opens, so none of
      // them checks out a second connection while it holds the first.
      const transactionOpenedAt = vi.mocked(prisma.$transaction).mock.invocationCallOrder[0];
      for (const read of [
        loadQuotaEvaluationContext,
        getContactByUserId,
        getOrganizationIdFromWorkspaceId,
        getOrganizationBilling,
      ]) {
        expect(vi.mocked(read).mock.invocationCallOrder[0]).toBeLessThan(transactionOpenedAt);
      }
      expect(prisma.response.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ contact: { connect: { id: contact.id } } }),
      });
      // Evaluated against the survey of the row written, with the preloaded context.
      expect(evaluateResponseQuotas).toHaveBeenCalledWith(
        expect.objectContaining({ surveyId: response.surveyId, quotaContext })
      );
    });
  });

  describe("getResponses", () => {
    test("return responses with meta information", async () => {
      (prisma.response.findMany as any).mockResolvedValue([response]);
      (prisma.response.count as any).mockResolvedValue(1);

      const result = await getResponses([workspaceId], responseFilter);
      expect(prisma.response.findMany).toHaveBeenCalled();
      expect(prisma.response.count).toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toEqual({
          data: [response],
          meta: {
            total: 1,
            limit: responseFilter.limit,
            offset: responseFilter.skip,
          },
        });
      }
    });

    test("return an internal_server_error error if prisma findMany fails", async () => {
      (prisma.response.findMany as any).mockRejectedValue(new Error("Internal server error"));
      (prisma.response.count as any).mockResolvedValue(0);

      const result = await getResponses([workspaceId], responseFilter);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "responses", issue: "Internal server error" }],
        });
      }
    });

    test("return an internal_server_error error if prisma count fails", async () => {
      (prisma.response.findMany as any).mockResolvedValue([response]);
      (prisma.response.count as any).mockRejectedValue(new Error("Internal server error"));

      const result = await getResponses([workspaceId], responseFilter);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual({
          type: "internal_server_error",
          details: [{ field: "responses", issue: "Internal server error" }],
        });
      }
    });
  });
});

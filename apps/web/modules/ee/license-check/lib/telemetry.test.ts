import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { collectTelemetryData } from "./telemetry";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    organization: { count: vi.fn(), findFirst: vi.fn() },
    user: { count: vi.fn(), findFirst: vi.fn() },
    team: { count: vi.fn() },
    project: { count: vi.fn() },
    survey: { count: vi.fn(), findFirst: vi.fn() },
    contact: { count: vi.fn() },
    segment: { count: vi.fn() },
    display: { count: vi.fn() },
    response: { count: vi.fn() },
    surveyLanguage: { findFirst: vi.fn() },
    surveyAttributeFilter: { findFirst: vi.fn() },
    apiKey: { findFirst: vi.fn() },
    teamUser: { findFirst: vi.fn() },
    surveyQuota: { findFirst: vi.fn() },
    webhook: { findFirst: vi.fn() },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_STORAGE_CONFIGURED: true,
  IS_RECAPTCHA_CONFIGURED: true,
  AUDIT_LOG_ENABLED: true,
  GOOGLE_OAUTH_ENABLED: true,
  GITHUB_OAUTH_ENABLED: false,
  AZURE_OAUTH_ENABLED: false,
  OIDC_OAUTH_ENABLED: false,
  SAML_OAUTH_ENABLED: false,
  AIRTABLE_CLIENT_ID: "test-airtable-id",
  SLACK_CLIENT_ID: "test-slack-id",
  SLACK_CLIENT_SECRET: "test-slack-secret",
  NOTION_OAUTH_CLIENT_ID: "test-notion-id",
  NOTION_OAUTH_CLIENT_SECRET: "test-notion-secret",
  GOOGLE_SHEETS_CLIENT_ID: "test-sheets-id",
  GOOGLE_SHEETS_CLIENT_SECRET: "test-sheets-secret",
}));

describe("Telemetry Collection", () => {
  const mockLicenseKey = "test-license-key-123";
  const mockOrganizationId = "org-123";

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.mocked(prisma.organization.findFirst).mockResolvedValue({
      id: mockOrganizationId,
      createdAt: new Date(),
    } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("collectTelemetryData", () => {
    test("should return null usage for cloud instances", async () => {
      // Mock IS_FORMBRICKS_CLOUD as true for this test
      const actualConstants = await vi.importActual("@/lib/constants");
      vi.doMock("@/lib/constants", () => ({
        ...(actualConstants as Record<string, unknown>),
        IS_FORMBRICKS_CLOUD: true,
      }));

      // Re-import to get the new mock
      const { collectTelemetryData: collectWithCloud } = await import("./telemetry");
      const result = await collectWithCloud(mockLicenseKey);

      expect(result.licenseKey).toBe(mockLicenseKey);
      expect(result.usage).toBeNull();

      // Reset mock
      vi.resetModules();
    });

    test("should collect basic counts successfully", async () => {
      vi.mocked(prisma.organization.count).mockResolvedValue(1);
      vi.mocked(prisma.user.count).mockResolvedValue(5);
      vi.mocked(prisma.team.count).mockResolvedValue(2);
      vi.mocked(prisma.project.count).mockResolvedValue(3);
      vi.mocked(prisma.survey.count).mockResolvedValue(10);
      vi.mocked(prisma.contact.count).mockResolvedValue(100);
      vi.mocked(prisma.segment.count).mockResolvedValue(5);
      vi.mocked(prisma.display.count).mockResolvedValue(500);
      vi.mocked(prisma.response.count).mockResolvedValue(1000);

      const result = await collectTelemetryData(mockLicenseKey);

      expect(result.usage).toBeTruthy();
      if (result.usage) {
        expect(result.usage.organizationCount).toBe(1);
        expect(result.usage.memberCount).toBe(5);
        expect(result.usage.teamCount).toBe(2);
        expect(result.usage.projectCount).toBe(3);
        expect(result.usage.surveyCount).toBe(10);
        expect(result.usage.contactCount).toBe(100);
        expect(result.usage.segmentCount).toBe(5);
        expect(result.usage.surveyDisplayCount).toBe(500);
        expect(result.usage.responseCountAllTime).toBe(1000);
      }
    });

    test("should handle query timeouts gracefully", async () => {
      // Simulate slow query that times out (but resolve it eventually)
      let resolveOrgCount: (value: number) => void;
      const orgCountPromise = new Promise<number>((resolve) => {
        resolveOrgCount = resolve;
      });
      vi.mocked(prisma.organization.count).mockImplementation(() => orgCountPromise as any);

      // Mock other queries to return quickly
      vi.mocked(prisma.user.count).mockResolvedValue(5);
      vi.mocked(prisma.team.count).mockResolvedValue(2);
      vi.mocked(prisma.project.count).mockResolvedValue(3);
      vi.mocked(prisma.survey.count).mockResolvedValue(10);
      vi.mocked(prisma.contact.count).mockResolvedValue(100);
      vi.mocked(prisma.segment.count).mockResolvedValue(5);
      vi.mocked(prisma.display.count).mockResolvedValue(500);
      vi.mocked(prisma.response.count).mockResolvedValue(1000);

      // Mock batch 2 queries
      vi.mocked(prisma.survey.findFirst).mockResolvedValue({ id: "survey-1" } as any);

      // Start collection
      const resultPromise = collectTelemetryData(mockLicenseKey);

      // Advance timers past the 2s query timeout
      await vi.advanceTimersByTimeAsync(3000);

      // Resolve the slow query after timeout
      resolveOrgCount!(1);

      const result = await resultPromise;

      // Should still return result, but with null values for timed-out queries
      expect(result.usage).toBeTruthy();
      expect(result.usage?.organizationCount).toBeNull();
      // Other queries should still work
      expect(result.usage?.memberCount).toBe(5);
    }, 15000);

    test("should handle database errors gracefully", async () => {
      const dbError = new Prisma.PrismaClientKnownRequestError("Database error", {
        code: "P2002",
        clientVersion: "5.0.0",
      });

      vi.mocked(prisma.organization.count).mockRejectedValue(dbError);
      vi.mocked(prisma.user.count).mockResolvedValue(5);

      const result = await collectTelemetryData(mockLicenseKey);

      // Should continue despite errors
      expect(result.usage).toBeTruthy();
      expect(result.usage?.organizationCount).toBeNull();
      expect(result.usage?.memberCount).toBe(5);
    });

    test("should detect feature usage correctly", async () => {
      // Mock feature detection queries
      vi.mocked(prisma.surveyLanguage.findFirst).mockResolvedValue({ languageId: "en" } as any);
      vi.mocked(prisma.user.findFirst).mockResolvedValueOnce({
        id: "user-2",
        twoFactorEnabled: true,
      } as any);
      vi.mocked(prisma.apiKey.findFirst).mockResolvedValue({ id: "key-1" } as any);

      // Mock all count queries to return 0 to avoid complexity
      vi.mocked(prisma.organization.count).mockResolvedValue(0);
      vi.mocked(prisma.user.count).mockResolvedValue(0);
      vi.mocked(prisma.team.count).mockResolvedValue(0);
      vi.mocked(prisma.project.count).mockResolvedValue(0);
      vi.mocked(prisma.survey.count).mockResolvedValue(0);
      vi.mocked(prisma.contact.count).mockResolvedValue(0);
      vi.mocked(prisma.segment.count).mockResolvedValue(0);
      vi.mocked(prisma.display.count).mockResolvedValue(0);
      vi.mocked(prisma.response.count).mockResolvedValue(0);

      const result = await collectTelemetryData(mockLicenseKey);

      expect(result.usage?.featureUsage).toBeTruthy();
      if (result.usage?.featureUsage) {
        expect(result.usage.featureUsage.multiLanguageSurveys).toBe(true);
        expect(result.usage.featureUsage.twoFA).toBe(true);
        expect(result.usage.featureUsage.apiKeys).toBe(true);
        expect(result.usage.featureUsage.sso).toBe(true); // From constants
        expect(result.usage.featureUsage.fileUpload).toBe(true); // From constants
      }
    });

    test("should generate instance ID when no organization exists", async () => {
      vi.mocked(prisma.organization.findFirst).mockResolvedValue(null);

      const result = await collectTelemetryData(mockLicenseKey);

      expect(result.usage).toBeTruthy();
      expect(result.usage?.instanceId).toBeTruthy();
      expect(typeof result.usage?.instanceId).toBe("string");
    });

    test("should handle total timeout gracefully", async () => {
      let resolveOrgFind: (value: any) => void;
      const orgFindPromise = new Promise<any>((resolve) => {
        resolveOrgFind = resolve;
      });
      vi.mocked(prisma.organization.findFirst).mockImplementation(() => orgFindPromise as any);

      let resolveOrgCount: (value: number) => void;
      const orgCountPromise = new Promise<number>((resolve) => {
        resolveOrgCount = resolve;
      });
      vi.mocked(prisma.organization.count).mockImplementation(() => orgCountPromise as any);

      // Start collection
      const resultPromise = collectTelemetryData(mockLicenseKey);

      // Advance timers past the 15s total timeout
      await vi.advanceTimersByTimeAsync(16000);

      resolveOrgFind!({ id: mockOrganizationId, createdAt: new Date() });
      resolveOrgCount!(1);

      const result = await resultPromise;

      // Should return usage object (may be empty or partial)
      expect(result.usage).toBeTruthy();
    }, 20000);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEnrichmentConfig } from "../types/enrichment";
import { enrichContactFromAPI, enrichContactsBatch, validateEnrichmentConfig } from "./contact-enrichment";

describe("contact-enrichment", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  describe("validateEnrichmentConfig", () => {
    it("should validate a correct config", () => {
      const config: Partial<TEnrichmentConfig> = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "none",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
      };

      const result = validateEnrichmentConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject config without API URL", () => {
      const config: Partial<TEnrichmentConfig> = {
        apiMethod: "GET",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
      };

      const result = validateEnrichmentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("API URL is required");
    });

    it("should reject config with invalid URL", () => {
      const config: Partial<TEnrichmentConfig> = {
        apiUrl: "not-a-valid-url",
        apiMethod: "GET",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
      };

      const result = validateEnrichmentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Invalid API URL format");
    });

    it("should reject config without response mapping", () => {
      const config: Partial<TEnrichmentConfig> = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        lookupColumn: "email",
        responseMapping: {},
      };

      const result = validateEnrichmentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("At least one response mapping is required");
    });

    it("should reject config with auth type but no auth value", () => {
      const config: Partial<TEnrichmentConfig> = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "bearer",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
      };

      const result = validateEnrichmentConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Authentication value is required when auth type is specified");
    });
  });

  describe("enrichContactFromAPI", () => {
    it("should enrich contact with GET request", async () => {
      const mockResponse = {
        name: "John Doe",
        company: "Acme Inc",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const record = { email: "john@example.com" };
      const config: TEnrichmentConfig = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "none",
        lookupColumn: "email",
        responseMapping: {
          name: "fullName",
          company: "companyName",
        },
        timeout: 5000,
      };

      const result = await enrichContactFromAPI(record, config);

      expect(result.success).toBe(true);
      expect(result.enrichedData).toEqual({
        email: "john@example.com",
        fullName: "John Doe",
        companyName: "Acme Inc",
      });
    });

    it("should handle nested API response fields", async () => {
      const mockResponse = {
        data: {
          user: {
            firstName: "John",
            lastName: "Doe",
          },
          employment: {
            company: "Acme Inc",
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const record = { email: "john@example.com" };
      const config: TEnrichmentConfig = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "none",
        lookupColumn: "email",
        responseMapping: {
          "data.user.firstName": "firstName",
          "data.user.lastName": "lastName",
          "data.employment.company": "company",
        },
        timeout: 5000,
      };

      const result = await enrichContactFromAPI(record, config);

      expect(result.success).toBe(true);
      expect(result.enrichedData).toEqual({
        email: "john@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Inc",
      });
    });

    it("should handle POST request with custom body template", async () => {
      const mockResponse = { name: "John Doe" };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const record = { userId: "12345" };
      const config: TEnrichmentConfig = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "POST",
        authType: "apiKey",
        authValue: "test-key",
        lookupColumn: "userId",
        requestBodyTemplate: JSON.stringify({
          userId: "{{lookupValue}}",
          fields: ["name", "email"],
        }),
        responseMapping: {
          name: "fullName",
        },
        timeout: 5000,
      };

      const result = await enrichContactFromAPI(record, config);

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.example.com/enrich",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "X-API-Key": "test-key",
          }),
          body: JSON.stringify({
            userId: "12345",
            fields: ["name", "email"],
          }),
        })
      );
    });

    it("should handle bearer token authentication", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ name: "John" }),
      });

      const record = { email: "john@example.com" };
      const config: TEnrichmentConfig = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "bearer",
        authValue: "test-token",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
        timeout: 5000,
      };

      await enrichContactFromAPI(record, config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-token",
          }),
        })
      );
    });

    it("should return error when lookup value is missing", async () => {
      const record = { firstName: "John" };
      const config: TEnrichmentConfig = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "none",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
        timeout: 5000,
      };

      const result = await enrichContactFromAPI(record, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing lookup value for column: email");
    });

    it("should handle API errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const record = { email: "john@example.com" };
      const config: TEnrichmentConfig = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "none",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
        timeout: 5000,
      };

      const result = await enrichContactFromAPI(record, config);

      expect(result.success).toBe(false);
      expect(result.error).toContain("API request failed with status 404");
    });
  });

  describe("enrichContactsBatch", () => {
    it("should enrich multiple contacts", async () => {
      (global.fetch as any).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ name: "Test User" }),
        })
      );

      const records = [
        { email: "user1@example.com" },
        { email: "user2@example.com" },
        { email: "user3@example.com" },
      ];

      const config: TEnrichmentConfig = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "none",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
        timeout: 5000,
      };

      const result = await enrichContactsBatch(records, config);

      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(3);
      expect(result.errorCount).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it("should handle partial failures", async () => {
      let callCount = 0;
      (global.fetch as any).mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({ ok: false, status: 500 });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ name: "Test User" }),
        });
      });

      const records = [
        { email: "user1@example.com" },
        { email: "user2@example.com" },
        { email: "user3@example.com" },
      ];

      const config: TEnrichmentConfig = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "none",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
        timeout: 5000,
      };

      const result = await enrichContactsBatch(records, config);

      expect(result.totalProcessed).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
    });

    it("should call progress callback", async () => {
      (global.fetch as any).mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ name: "Test User" }),
        })
      );

      const records = [{ email: "user1@example.com" }, { email: "user2@example.com" }];

      const config: TEnrichmentConfig = {
        apiUrl: "https://api.example.com/enrich",
        apiMethod: "GET",
        authType: "none",
        lookupColumn: "email",
        responseMapping: { name: "fullName" },
        timeout: 5000,
      };

      const onProgress = vi.fn();
      await enrichContactsBatch(records, config, { onProgress });

      expect(onProgress).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(2, 2);
    });
  });
});

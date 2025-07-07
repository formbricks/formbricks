import { expect } from "@playwright/test";
import { test } from "../../lib/fixtures";
import { loginAndGetApiKey } from "../../lib/utils";

test.describe("API Tests for Single Contact Creation", () => {
  test("Create and Test Contact Creation via API", async ({ page, users, request }) => {
    let environmentId, apiKey;

    try {
      ({ environmentId, apiKey } = await loginAndGetApiKey(page, users));
    } catch (error) {
      console.error("Error during login and getting API key:", error);
      throw error;
    }

    const baseEmail = `test-${Date.now()}`;

    await test.step("Create contact successfully with email only", async () => {
      const uniqueEmail = `${baseEmail}-single@example.com`;

      const response = await request.post("/api/v2/management/contacts", {
        headers: { "x-api-key": apiKey },
        data: {
          environmentId,
          attributes: {
            email: uniqueEmail,
          },
        },
      });

      expect(response.status()).toBe(201);

      const contactData = await response.json();
      expect(contactData.data).toBeDefined();
      expect(contactData.data.id).toMatch(/^[a-z0-9]{25}$/); // CUID2 format
      expect(contactData.data.environmentId).toBe(environmentId);
      expect(contactData.data.attributes.email).toBe(uniqueEmail);
      expect(contactData.data.createdAt).toBeDefined();
    });

    await test.step("Create contact successfully with multiple attributes", async () => {
      const uniqueEmail = `${baseEmail}-multi@example.com`;
      const uniqueUserId = `usr_${Date.now()}`;

      const response = await request.post("/api/v2/management/contacts", {
        headers: { "x-api-key": apiKey },
        data: {
          environmentId,
          attributes: {
            email: uniqueEmail,
            firstName: "John",
            lastName: "Doe",
            userId: uniqueUserId,
          },
        },
      });

      expect(response.status()).toBe(201);

      const contactData = await response.json();
      expect(contactData.data.attributes.email).toBe(uniqueEmail);
      expect(contactData.data.attributes.firstName).toBe("John");
      expect(contactData.data.attributes.lastName).toBe("Doe");
      expect(contactData.data.attributes.userId).toBe(uniqueUserId);
    });

    await test.step("Return error for missing attribute keys", async () => {
      const uniqueEmail = `${baseEmail}-newkey@example.com`;
      const customKey = `customAttribute_${Date.now()}`;

      const response = await request.post("/api/v2/management/contacts", {
        headers: { "x-api-key": apiKey },
        data: {
          environmentId,
          attributes: {
            email: uniqueEmail,
            [customKey]: "custom value",
          },
        },
      });

      expect(response.status()).toBe(400);

      const errorData = await response.json();
      expect(errorData.error.details[0].field).toBe("attributes");
      expect(errorData.error.details[0].issue).toContain("attribute keys not found");
      expect(errorData.error.details[0].issue).toContain(customKey);
    });

    await test.step("Prevent duplicate email addresses", async () => {
      const duplicateEmail = `${baseEmail}-duplicate@example.com`;

      // Create first contact
      const firstResponse = await request.post("/api/v2/management/contacts", {
        headers: { "x-api-key": apiKey },
        data: {
          environmentId,
          attributes: {
            email: duplicateEmail,
          },
        },
      });
      expect(firstResponse.status()).toBe(201);

      // Try to create second contact with same email
      const secondResponse = await request.post("/api/v2/management/contacts", {
        headers: { "x-api-key": apiKey },
        data: {
          environmentId,
          attributes: {
            email: duplicateEmail,
          },
        },
      });

      expect(secondResponse.status()).toBe(409);

      const errorData = await secondResponse.json();

      expect(errorData.error.details[0].field).toBe("email");
      expect(errorData.error.details[0].issue).toContain("already exists");
    });

    await test.step("Prevent duplicate userId", async () => {
      const duplicateUserId = `usr_duplicate_${Date.now()}`;
      const email1 = `${baseEmail}-userid1@example.com`;
      const email2 = `${baseEmail}-userid2@example.com`;

      // Create first contact
      const firstResponse = await request.post("/api/v2/management/contacts", {
        headers: { "x-api-key": apiKey },
        data: {
          environmentId,
          attributes: {
            email: email1,
            userId: duplicateUserId,
          },
        },
      });
      expect(firstResponse.status()).toBe(201);

      // Try to create second contact with same userId but different email
      const secondResponse = await request.post("/api/v2/management/contacts", {
        headers: { "x-api-key": apiKey },
        data: {
          environmentId,
          attributes: {
            email: email2,
            userId: duplicateUserId,
          },
        },
      });

      expect(secondResponse.status()).toBe(409);

      const errorData = await secondResponse.json();
      expect(errorData.error.details[0].field).toBe("userId");
      expect(errorData.error.details[0].issue).toContain("already exists");
    });
  });
});

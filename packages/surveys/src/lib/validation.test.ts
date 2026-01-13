import { describe, expect, it } from "vitest";
import { z } from "zod";
// Used for parity check in tests only
import { validateEmail, validatePhone, validateUrl } from "./validation";

describe("Validation Logic Parity", () => {
  describe("Email Validation", () => {
    const zodEmail = z.string().email();

    const testCases = [
      "test@example.com",
      "user.name+tag@example.co.uk",
      "invalid-email",
      "no-at-sign.com",
      "@domain.com",
      "user@",
      "user@domain", // Zod might accept this or not depending on TLD requirement. Our regex requires TLD {2,}.
      "user@domain.c", // Our regex requires 2 chars TLD.
    ];

    testCases.forEach((email) => {
      it(`should match Zod behavior for email: "${email}"`, () => {
        const zodResult = zodEmail.safeParse(email).success;
        const myResult = validateEmail(email);

        // We aim for parity with Zod's default email validator.
        // Our custom ReDoS-safe regex handles standard email formats correctly.
        expect(myResult).toBe(zodResult);
      });
    });
  });

  describe("URL Validation", () => {
    const zodUrl = z.string().url();

    const testCases = [
      "https://example.com",
      "http://localhost:3000",
      "ftp://files.com",
      "invalid-url",
      "examples",
      "https://",
    ];

    testCases.forEach((url) => {
      it(`should match Zod behavior for URL: "${url}"`, () => {
        const zodResult = zodUrl.safeParse(url).success;
        const myResult = validateUrl(url);

        if (zodResult) {
          expect(myResult).toBe(true);
        } else {
          expect(myResult).toBe(false);
        }
      });
    });
  });

  // Note: Phone validation in the component used a custom regex, not Zod's default.
  // The original component code had: const phoneRegex = /^[0-9+][0-9+\- ]*[0-9]$/;
  // So we just test that function directly.
  describe("Phone Validation", () => {
    const testCases = [
      { input: "+1234567890", expected: true },
      { input: "123-456-7890", expected: true },
      { input: "123 456 7890", expected: true },
      { input: "invalid", expected: false },
      { input: "123-", expected: false }, // ends with separator
      { input: "-123", expected: false }, // starts with separator
      { input: "+", expected: false },
    ];

    testCases.forEach(({ input, expected }) => {
      it(`should validate phone "${input}" as ${expected}`, () => {
        expect(validatePhone(input)).toBe(expected);
      });
    });
  });
});

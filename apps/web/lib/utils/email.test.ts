import { describe, expect, test } from "vitest";
import { isValidEmail } from "./email";

describe("isValidEmail", () => {
  test("validates correct email formats", () => {
    // Valid email addresses
    expect(isValidEmail("test@example.com")).toBe(true);
    expect(isValidEmail("test.user@example.com")).toBe(true);
    expect(isValidEmail("test+user@example.com")).toBe(true);
    expect(isValidEmail("test_user@example.com")).toBe(true);
    expect(isValidEmail("test-user@example.com")).toBe(true);
    expect(isValidEmail("test'user@example.com")).toBe(true);
    expect(isValidEmail("test@example.co.uk")).toBe(true);
    expect(isValidEmail("test@subdomain.example.com")).toBe(true);
  });

  test("rejects invalid email formats", () => {
    // Missing @ symbol
    expect(isValidEmail("testexample.com")).toBe(false);

    // Multiple @ symbols
    expect(isValidEmail("test@example@com")).toBe(false);

    // Invalid characters
    expect(isValidEmail("test user@example.com")).toBe(false);
    expect(isValidEmail("test<>user@example.com")).toBe(false);

    // Missing domain
    expect(isValidEmail("test@")).toBe(false);

    // Missing local part
    expect(isValidEmail("@example.com")).toBe(false);

    // Starting or ending with dots in local part
    expect(isValidEmail(".test@example.com")).toBe(false);
    expect(isValidEmail("test.@example.com")).toBe(false);

    // Consecutive dots
    expect(isValidEmail("test..user@example.com")).toBe(false);

    // Empty string
    expect(isValidEmail("")).toBe(false);

    // Only whitespace
    expect(isValidEmail(" ")).toBe(false);

    // TLD too short
    expect(isValidEmail("test@example.c")).toBe(false);
  });
});

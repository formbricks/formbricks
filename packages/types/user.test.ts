import { describe, expect, test } from "vitest";
import { ZUserCurrentPassword, ZUserPassword, ZUserPersonalInfoUpdateInput } from "./user";

// bcrypt only hashes the first 72 bytes of its input, so a password longer than that is
// silently truncated: two passwords sharing their first 72 bytes become the same password.
describe("ZUserPassword byte limit", () => {
  const ascii = (length: number) => `Aa1${"x".repeat(length - 3)}`;

  test("accepts exactly 72 bytes", () => {
    expect(ZUserPassword.safeParse(ascii(72)).success).toBe(true);
  });

  test("rejects 73 ASCII bytes", () => {
    const result = ZUserPassword.safeParse(ascii(73));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Password must be 72 bytes or less");
  });

  test("counts UTF-8 bytes, not characters", () => {
    // 3 + 35 two-byte characters = 73 bytes, but only 38 characters
    const multiByte = `Aa1${"é".repeat(35)}`;
    expect(multiByte).toHaveLength(38);
    expect(Buffer.byteLength(multiByte, "utf8")).toBe(73);
    expect(ZUserPassword.safeParse(multiByte).success).toBe(false);
    expect(ZUserPassword.safeParse(`Aa1${"é".repeat(34)}`).success).toBe(true);
  });

  test("two passwords sharing their first 72 bytes are not both accepted", () => {
    expect(ZUserPassword.safeParse(`${ascii(72)}A`).success).toBe(false);
    expect(ZUserPassword.safeParse(`${ascii(72)}B`).success).toBe(false);
  });

  test("still enforces the existing rules", () => {
    expect(ZUserPassword.safeParse("Aa1xxxx").success).toBe(false); // too short
    expect(ZUserPassword.safeParse("aaaaaaaa1").success).toBe(false); // no uppercase
  });
});

describe("ZUserCurrentPassword (verify-only)", () => {
  test("keeps accepting an existing password longer than 72 bytes", () => {
    expect(ZUserCurrentPassword.safeParse(`Aa1${"x".repeat(100)}`).success).toBe(true);
  });

  test("still caps at 128 characters", () => {
    expect(ZUserCurrentPassword.safeParse(`Aa1${"x".repeat(126)}`).success).toBe(false);
  });
});

describe("ZUserPersonalInfoUpdateInput", () => {
  test("accepts a password above the bcrypt limit for verification", () => {
    expect(ZUserPersonalInfoUpdateInput.safeParse({ password: `Aa1${"x".repeat(100)}` }).success).toBe(true);
  });

  test("still enforces the limit on a password being set", () => {
    expect(ZUserPassword.safeParse(`Aa1${"x".repeat(100)}`).success).toBe(false);
  });
});

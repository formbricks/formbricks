import * as nextHeaders from "next/headers";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getClientIpFromHeaders } from "./client-ip";

// Mock next/headers
declare module "next/headers" {
  export function headers(): any;
}

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

const mockHeaders = (headerMap: Record<string, string | undefined>) => {
  vi.mocked(nextHeaders.headers).mockReturnValue({
    get: (key: string) => headerMap[key.toLowerCase()] ?? undefined,
  });
};

describe("getClientIpFromHeaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns cf-connecting-ip if present", async () => {
    mockHeaders({ "cf-connecting-ip": "1.2.3.4" });
    const ip = await getClientIpFromHeaders();
    expect(ip).toBe("1.2.3.4");
  });

  test("returns first x-forwarded-for if cf-connecting-ip is missing", async () => {
    mockHeaders({ "x-forwarded-for": "5.6.7.8, 9.10.11.12" });
    const ip = await getClientIpFromHeaders();
    expect(ip).toBe("5.6.7.8");
  });

  test("returns x-real-ip if cf-connecting-ip and x-forwarded-for are missing", async () => {
    mockHeaders({ "x-real-ip": "13.14.15.16" });
    const ip = await getClientIpFromHeaders();
    expect(ip).toBe("13.14.15.16");
  });

  test("returns ::1 if no headers are present", async () => {
    mockHeaders({});
    const ip = await getClientIpFromHeaders();
    expect(ip).toBe("::1");
  });

  test("trims whitespace in x-forwarded-for", async () => {
    mockHeaders({ "x-forwarded-for": "  21.22.23.24  , 25.26.27.28" });
    const ip = await getClientIpFromHeaders();
    expect(ip).toBe("21.22.23.24");
  });

  test("getClientIpFromHeaders should return the value of the cf-connecting-ip header when it is present", async () => {
    const testIp = "123.123.123.123";

    vi.mocked(nextHeaders.headers).mockReturnValue({
      get: vi.fn().mockImplementation((headerName: string) => {
        if (headerName === "cf-connecting-ip") {
          return testIp;
        }
        return null;
      }),
    } as any);

    const result = await getClientIpFromHeaders();

    expect(result).toBe(testIp);
    expect(nextHeaders.headers).toHaveBeenCalled();
  });

  test("getClientIpFromHeaders should handle errors when headers() throws an exception", async () => {
    vi.mocked(nextHeaders.headers).mockImplementation(() => {
      throw new Error("Failed to get headers");
    });

    const result = await getClientIpFromHeaders();

    expect(result).toBe("::1");
  });
});

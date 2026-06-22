import { cleanup } from "@testing-library/react";
import { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getSessionUser } from "@/app/api/v1/management/me/lib/utils";
import { authOptions } from "@/modules/auth/lib/authOptions";
import { mockUser } from "@/modules/auth/lib/mock-data";
import { getSession } from "@/modules/auth/lib/session";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/modules/auth/lib/authOptions", () => ({
  authOptions: {},
}));

// The no-req/res path reads the Better Auth session DAL (utils.ts:13), not getServerSession (ENG-1054).
vi.mock("@/modules/auth/lib/session", () => ({
  getSession: vi.fn(),
}));

describe("getSessionUser", () => {
  afterEach(() => {
    cleanup();
  });

  test("should return the user object when valid req and res are provided", async () => {
    const mockReq = {} as NextApiRequest;
    const mockRes = {} as NextApiResponse;

    vi.mocked(getServerSession).mockResolvedValue({ user: mockUser });

    const user = await getSessionUser(mockReq, mockRes);

    expect(user).toEqual(mockUser);
    expect(getServerSession).toHaveBeenCalledWith(mockReq, mockRes, authOptions);
  });

  test("should return the user object when neither req nor res are provided", async () => {
    vi.mocked(getSession).mockResolvedValue({ user: mockUser } as never);

    const user = await getSessionUser();

    expect(user).toEqual(mockUser);
    expect(getSession).toHaveBeenCalled();
    expect(getServerSession).not.toHaveBeenCalled();
  });

  test("should return undefined if no session exists", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const user = await getSessionUser();

    expect(user).toBeUndefined();
  });

  test("should return null when session exists and user property is null", async () => {
    const mockReq = {} as NextApiRequest;
    const mockRes = {} as NextApiResponse;

    vi.mocked(getServerSession).mockResolvedValue({ user: null });

    const user = await getSessionUser(mockReq, mockRes);

    expect(user).toBeNull();
    expect(getServerSession).toHaveBeenCalledWith(mockReq, mockRes, authOptions);
  });
});

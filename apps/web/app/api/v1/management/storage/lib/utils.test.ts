import { checkForRequiredFields } from "./utils";
import { describe, it, expect } from "vitest";

describe("checkForRequiredFields", () => {
    it("should return undefined when all required fields are present", () => {
        const result = checkForRequiredFields("env123", "image/jpeg", "test.jpg");
        expect(result).toBeUndefined();
    });

    it("should return bad request response when environmentId is missing", async () => {
        const result = checkForRequiredFields("", "image/jpeg", "test.jpg");
        expect(result).toBeDefined();
        expect(result?.status).toBe(400);
        const body = await result?.json();
        expect(body).toEqual({ error: "environmentId is required" });
    });

    it("should return bad request response when fileType is missing", async () => {
        const result = checkForRequiredFields("env123", "", "test.jpg");
        expect(result).toBeDefined();
        expect(result?.status).toBe(400);
        const body = await result?.json();
        expect(body).toEqual({ error: "contentType is required" });
    });

    it("should return bad request response when encodedFileName is missing", async () => {
        const result = checkForRequiredFields("env123", "image/jpeg", "");
        expect(result).toBeDefined();
        expect(result?.status).toBe(400);
        const body = await result?.json();
        expect(body).toEqual({ error: "fileName is required" });
    });

    it("should return bad request response when environmentId is undefined", async () => {
        const result = checkForRequiredFields(undefined as any, "image/jpeg", "test.jpg");
        expect(result).toBeDefined();
        expect(result?.status).toBe(400);
        const body = await result?.json();
        expect(body).toEqual({ error: "environmentId is required" });
    });

    it("should return bad request response when fileType is undefined", async () => {
        const result = checkForRequiredFields("env123", undefined as any, "test.jpg");
        expect(result).toBeDefined();
        expect(result?.status).toBe(400);
        const body = await result?.json();
        expect(body).toEqual({ error: "contentType is required" });
    });

    it("should return bad request response when encodedFileName is undefined", async () => {
        const result = checkForRequiredFields("env123", "image/jpeg", undefined as any);
        expect(result).toBeDefined();
        expect(result?.status).toBe(400);
        const body = await result?.json();
        expect(body).toEqual({ error: "fileName is required" });
    });
}); 
import { checkForRequiredFields } from "./utils";
import { responses } from "@/app/lib/api/response";
import { describe, it, expect } from "vitest";

describe("checkForRequiredFields", () => {
    it("should return undefined when all required fields are present", () => {
        const result = checkForRequiredFields("env123", "image/jpeg", "test.jpg");
        expect(result).toBeUndefined();
    });

    it("should return bad request response when environmentId is missing", () => {
        const result = checkForRequiredFields("", "image/jpeg", "test.jpg");
        expect(result).toEqual(responses.badRequestResponse("environmentId is required"));
    });

    it("should return bad request response when fileType is missing", () => {
        const result = checkForRequiredFields("env123", "", "test.jpg");
        expect(result).toEqual(responses.badRequestResponse("contentType is required"));
    });

    it("should return bad request response when encodedFileName is missing", () => {
        const result = checkForRequiredFields("env123", "image/jpeg", "");
        expect(result).toEqual(responses.badRequestResponse("fileName is required"));
    });

    it("should return bad request response when environmentId is undefined", () => {
        const result = checkForRequiredFields(undefined as any, "image/jpeg", "test.jpg");
        expect(result).toEqual(responses.badRequestResponse("environmentId is required"));
    });

    it("should return bad request response when fileType is undefined", () => {
        const result = checkForRequiredFields("env123", undefined as any, "test.jpg");
        expect(result).toEqual(responses.badRequestResponse("contentType is required"));
    });

    it("should return bad request response when encodedFileName is undefined", () => {
        const result = checkForRequiredFields("env123", "image/jpeg", undefined as any);
        expect(result).toEqual(responses.badRequestResponse("fileName is required"));
    });
}); 
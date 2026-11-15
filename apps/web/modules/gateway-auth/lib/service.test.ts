import { describe, expect, test } from "vitest";
import { ZGatewayAuthService } from "./service";

describe("gateway auth service registry", () => {
  test("validates supported gateway auth services", () => {
    expect(ZGatewayAuthService.parse("feedbackRecords")).toBe("feedbackRecords");
    expect(() => ZGatewayAuthService.parse("unknownService")).toThrow();
  });
});

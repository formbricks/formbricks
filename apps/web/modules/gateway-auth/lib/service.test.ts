import { describe, expect, test } from "vitest";
import { getGatewayAuthServiceTokenPurpose, ZGatewayAuthService } from "./service";

describe("gateway auth service registry", () => {
  test("returns the configured token purpose for feedbackRecords", () => {
    expect(getGatewayAuthServiceTokenPurpose("feedbackRecords")).toBe("feedback_records_gateway");
  });

  test("validates supported gateway auth services", () => {
    expect(ZGatewayAuthService.parse("feedbackRecords")).toBe("feedbackRecords");
    expect(() => ZGatewayAuthService.parse("unknownService")).toThrow();
  });
});

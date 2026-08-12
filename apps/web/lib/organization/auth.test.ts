import { describe, expect, test, vi } from "vitest";
import { TOrganization } from "@formbricks/types/organizations";
import { canUserAccessOrganization } from "./auth";
import { getOrganizationsByUserId } from "./service";

vi.mock("./service", () => ({
  getOrganizationsByUserId: vi.fn(),
}));

describe("auth", () => {
  describe("canUserAccessOrganization", () => {
    test("returns true when user has access to organization", async () => {
      const mockOrganizations: TOrganization[] = [
        {
          id: "org1",
          createdAt: new Date(),
          updatedAt: new Date(),
          name: "Org 1",
          billing: {
            stripeCustomerId: null,
            limits: {
              workspaces: 3,
              monthly: {
                responses: 1500,
              },
            },
            usageCycleAnchor: new Date(),
          },
          isAISmartToolsEnabled: false,
        },
      ];
      vi.mocked(getOrganizationsByUserId).mockResolvedValue(mockOrganizations);

      const result = await canUserAccessOrganization("user1", "org1");
      expect(result).toBe(true);
    });
  });
});

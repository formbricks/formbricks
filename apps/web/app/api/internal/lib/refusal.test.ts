import { describe, expect, test, vi } from "vitest";
import { OperationNotAllowedError, ResourceNotFoundError } from "@formbricks/types/errors";
import { forbidOnRefusal } from "./refusal";

vi.mock("server-only", () => ({}));

const REQUEST_ID = "req-1";

describe("forbidOnRefusal", () => {
  test("answers null when the step goes through", async () => {
    await expect(forbidOnRefusal(async () => "done", REQUEST_ID)).resolves.toBeNull();
  });

  test("answers 403 with the refusal's own reason", async () => {
    const response = (await forbidOnRefusal(async () => {
      throw new OperationNotAllowedError("Only owners can change an owner invite");
    }, REQUEST_ID)) as Response;

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Only owners can change an owner invite");
  });

  test("answers the generic 403 for a missing resource, as for one the caller can't see", async () => {
    const response = (await forbidOnRefusal(async () => {
      throw new ResourceNotFoundError("Invite", "inv-1");
    }, REQUEST_ID)) as Response;

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("lets any other error through", async () => {
    const boom = new Error("boom");
    await expect(
      forbidOnRefusal(async () => {
        throw boom;
      }, REQUEST_ID)
    ).rejects.toBe(boom);
  });
});

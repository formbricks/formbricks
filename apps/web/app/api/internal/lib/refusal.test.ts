import { describe, expect, test, vi } from "vitest";
import {
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  ValidationError,
} from "@formbricks/types/errors";
import { forbidOnRefusal, refusalResponse } from "./refusal";

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

describe("refusalResponse", () => {
  test("answers 403 with an OperationNotAllowedError's own reason", async () => {
    const response = refusalResponse(
      new OperationNotAllowedError("Cannot reset an archived survey."),
      REQUEST_ID
    );

    expect(response?.status).toBe(403);
    expect((await response?.json()).detail).toBe("Cannot reset an archived survey.");
  });

  test("answers the generic 403 for a missing resource", async () => {
    const response = refusalResponse(new ResourceNotFoundError("Survey", "survey-1"), REQUEST_ID);

    expect(response?.status).toBe(403);
    expect((await response?.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("answers 422 with an InvalidInputError's own reason", async () => {
    const response = refusalResponse(new InvalidInputError("Invalid user segment filters"), REQUEST_ID);

    expect(response?.status).toBe(422);
    expect((await response?.json()).detail).toBe("Invalid user segment filters");
  });

  test("answers 422 with a ValidationError's own reason, as for a survey that fails its own checks", async () => {
    const response = refusalResponse(new ValidationError("Survey must have at least one block"), REQUEST_ID);

    expect(response?.status).toBe(422);
    expect((await response?.json()).detail).toBe("Survey must have at least one block");
  });

  test("answers null for any other error", () => {
    expect(refusalResponse(new Error("boom"), REQUEST_ID)).toBeNull();
  });
});

describe("forbidOnRefusal and invalid input", () => {
  test("lets an InvalidInputError through", async () => {
    const invalid = new InvalidInputError("bad");
    await expect(
      forbidOnRefusal(async () => {
        throw invalid;
      }, REQUEST_ID)
    ).rejects.toBe(invalid);
  });
});

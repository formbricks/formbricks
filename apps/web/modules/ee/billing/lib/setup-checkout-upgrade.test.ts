import { describe, expect, test, vi } from "vitest";
import { runSetupCheckoutUpgrade } from "./setup-checkout-upgrade";

const finalized = { targetPlan: "pro" as const, requiresAction: false, clientSecret: null };
const setup = () => ({
  pendingPlan: "scale" as const,
  finalize: vi.fn().mockResolvedValue({ data: finalized }),
  confirm: vi.fn().mockResolvedValue({ applied: true, message: null }),
  waitForPlan: vi.fn().mockResolvedValue(true),
});

describe("runSetupCheckoutUpgrade", () => {
  test("confirms the finalized plan before waiting for its snapshot", async () => {
    const input = setup();

    await expect(runSetupCheckoutUpgrade(input)).resolves.toEqual({ status: "applied", plan: "pro" });
    expect(input.confirm).toHaveBeenCalledWith(finalized);
    expect(input.waitForPlan).toHaveBeenCalledWith("pro");
    expect(input.confirm.mock.invocationCallOrder[0]).toBeLessThan(
      input.waitForPlan.mock.invocationCallOrder[0]
    );
  });

  test("only reports pending after finalization and confirmation succeeded", async () => {
    const input = setup();
    input.waitForPlan.mockResolvedValue(false);

    await expect(runSetupCheckoutUpgrade(input)).resolves.toEqual({ status: "pending" });
    expect(input.confirm).toHaveBeenCalledOnce();
  });

  test.each(["finalize", "confirm", "waitForPlan"] as const)(
    "a rejected %s has an unknown outcome and is not automatically retried",
    async (stage) => {
      const input = setup();
      const error = new Error("502 Bad Gateway");
      input[stage].mockRejectedValue(error);

      await expect(runSetupCheckoutUpgrade(input)).resolves.toEqual({ status: "unknown", error });
      expect(input[stage]).toHaveBeenCalledOnce();
      if (stage === "finalize") {
        expect(input.confirm).not.toHaveBeenCalled();
        expect(input.waitForPlan).not.toHaveBeenCalled();
      }
    }
  );

  test("an explicit retry can resume the same completed checkout after a rejected finalization", async () => {
    const input = setup();
    input.finalize.mockRejectedValueOnce(new Error("502 Bad Gateway"));

    expect((await runSetupCheckoutUpgrade(input)).status).toBe("unknown");
    await expect(runSetupCheckoutUpgrade(input)).resolves.toEqual({ status: "applied", plan: "pro" });
    expect(input.finalize).toHaveBeenCalledTimes(2);
  });

  test("a server refusal is a known failure and never proceeds to payment confirmation", async () => {
    const input = setup();
    input.finalize.mockResolvedValue({ serverError: "Upgrade is not allowed" });

    await expect(runSetupCheckoutUpgrade(input)).resolves.toEqual({
      status: "failed",
      message: "Upgrade is not allowed",
    });
    expect(input.confirm).not.toHaveBeenCalled();
    expect(input.waitForPlan).not.toHaveBeenCalled();
  });

  test("a declined confirmation is a known failure and does not wait for a plan", async () => {
    const input = setup();
    input.confirm.mockResolvedValue({ applied: false, message: "Authentication failed" });

    await expect(runSetupCheckoutUpgrade(input)).resolves.toEqual({
      status: "failed",
      message: "Authentication failed",
    });
    expect(input.waitForPlan).not.toHaveBeenCalled();
  });
});

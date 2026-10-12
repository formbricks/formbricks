type TCheckoutUpgradePlan = "pro" | "scale";

interface TFinalizedCheckoutUpgrade {
  targetPlan: TCheckoutUpgradePlan | null;
  requiresAction: boolean;
  clientSecret: string | null;
}

interface TSetupCheckoutUpgradeInput {
  pendingPlan: TCheckoutUpgradePlan | null;
  finalize: () => Promise<{ data?: TFinalizedCheckoutUpgrade; serverError?: string } | undefined>;
  confirm: (data: TFinalizedCheckoutUpgrade) => Promise<{ applied: boolean; message: string | null }>;
  waitForPlan: (plan: TCheckoutUpgradePlan) => Promise<boolean>;
}

export type TSetupCheckoutUpgradeOutcome =
  | { status: "applied"; plan: TCheckoutUpgradePlan | null }
  | { status: "pending" }
  | { status: "failed"; message: string | null }
  | { status: "unknown"; error: unknown };

/**
 * Finalization applies the upgrade; a setup-checkout webhook only saves the card. A rejected request
 * therefore cannot be treated like a confirmed upgrade awaiting synchronization. Keep that outcome
 * distinct so the caller preserves the checkout session for an explicit retry, without retrying here.
 */
export const runSetupCheckoutUpgrade = async ({
  pendingPlan,
  finalize,
  confirm,
  waitForPlan,
}: TSetupCheckoutUpgradeInput): Promise<TSetupCheckoutUpgradeOutcome> => {
  try {
    const response = await finalize();
    if (response?.serverError) return { status: "failed", message: response.serverError };

    const plan = response?.data?.targetPlan ?? pendingPlan;
    if (response?.data) {
      const confirmation = await confirm(response.data);
      if (!confirmation.applied) return { status: "failed", message: confirmation.message };
    }

    if (!plan) return { status: "applied", plan: null };

    return (await waitForPlan(plan)) ? { status: "applied", plan } : { status: "pending" };
  } catch (error) {
    return { status: "unknown", error };
  }
};

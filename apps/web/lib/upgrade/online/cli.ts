import "server-only";
import { readFile } from "node:fs/promises";
import { OnlineUpgradeBlocked, summarizeOnlineState, toOnlineBlocker } from "./coordinator";
import { KubernetesUpgrade, onlineConfigSchema } from "./kubernetes";
import { readOnlineStatus, runOnlineCommand } from "./runtime";

export const runKubernetesOnlineCli = async (args: string[], assetRoot: URL) => {
  try {
    const [command, ...extra] = args;
    if (!["prepare", "finalize", "status"].includes(command) || extra.length)
      throw new OnlineUpgradeBlocked("invalid_online_command");
    if (command === "status") return await readOnlineStatus();
    const raw: unknown = JSON.parse(await readFile("/etc/formbricks-online/config.json", "utf8"));
    const config = onlineConfigSchema.parse(raw);
    const sources: Record<string, string[]> = JSON.parse(
      await readFile(new URL("source-images.json", assetRoot), "utf8")
    );
    config.sourceDigests = sources[config.sourceVersion];
    if (!config.sourceDigests?.length) throw new OnlineUpgradeBlocked("unsupported_source_release");
    const platform = await KubernetesUpgrade.connect(config);
    return await runOnlineCommand(
      command as "prepare" | "finalize" | "status",
      {
        targetImage: config.targetImage,
        sourceVersion: config.sourceVersion,
        sessionAffinity: config.sessionAffinity,
        preflight: (retirementStarted) => platform.preflight(retirementStarted),
        verifySourceConsumersAbsent: () => platform.verifySourceConsumersAbsent(),
        jobDrainTimeoutSeconds: config.jobDrainTimeoutSeconds,
        retireSourceConsumers: async (assertLock) => {
          platform.assertLock = assertLock;
          await platform.retireSourceConsumers();
        },
        verifyConsumers: () => platform.waitForConsumers(),
        handoff: async (assertLock) => {
          platform.assertLock = assertLock;
          const template = JSON.parse(await readFile("/etc/formbricks-online/deployment.json", "utf8"));
          await platform.handoff(template);
        },
        releaseAccess: async (assertLock) => {
          platform.assertLock = assertLock;
          await platform.releaseAccess();
        },
        cleanup: async (assertLock) => {
          platform.assertLock = assertLock;
          await platform.cleanup();
        },
      },
      assetRoot
    );
  } catch (error) {
    const result = summarizeOnlineState(null, toOnlineBlocker(error, "invalid_online_configuration"));
    result.rollbackTo60Allowed = false;
    return result;
  }
};

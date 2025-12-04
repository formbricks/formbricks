import { TActionClassInput } from "@formbricks/types/action-classes";
import { createActionClass } from "@/modules/survey/editor/lib/action-class";
import { getActionClasses } from "@/modules/survey/lib/action-class";
import { type TExportedTrigger } from "../export-survey";

export interface TMappedTrigger {
  actionClass: { id: string };
}

export const mapTriggers = async (
  importedTriggers: TExportedTrigger[],
  environmentId: string
): Promise<{ mapped: TMappedTrigger[]; skipped: string[] }> => {
  if (!importedTriggers || importedTriggers.length === 0) {
    return { mapped: [], skipped: [] };
  }

  const existingActionClasses = await getActionClasses(environmentId);
  const mappedTriggers: TMappedTrigger[] = [];
  const skipped: string[] = [];

  for (const trigger of importedTriggers) {
    const ac = trigger.actionClass;

    let existing = existingActionClasses.find((e) => e.key === ac.key && e.type === ac.type);

    if (!existing) {
      try {
        const actionClassInput: TActionClassInput = {
          environmentId,
          name: `${ac.name} (imported)`,
          description: ac.description ?? null,
          type: ac.type,
          key: ac.key,
          noCodeConfig: ac.noCodeConfig,
        };
        existing = await createActionClass(environmentId, actionClassInput);
      } catch (error) {
        existing = await getActionClasses(environmentId).then((classes) =>
          classes.find((e) => e.key === ac.key && e.type === ac.type)
        );
      }
    }

    if (existing) {
      mappedTriggers.push({
        actionClass: { id: existing.id },
      });
    } else {
      skipped.push(`Could not find or create action class: ${ac.name} (${ac.key ?? "no key"})`);
    }
  }

  return { mapped: mappedTriggers, skipped };
};

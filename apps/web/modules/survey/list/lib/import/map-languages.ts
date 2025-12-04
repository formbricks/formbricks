import { getProject } from "@/lib/project/service";
import { type TExportedLanguage } from "../export-survey";

export interface TMappedLanguage {
  languageId: string;
  enabled: boolean;
  default: boolean;
}

export const mapLanguages = async (
  exportedLanguages: TExportedLanguage[],
  projectId: string
): Promise<{ mapped: TMappedLanguage[]; skipped: string[] }> => {
  if (!exportedLanguages || exportedLanguages.length === 0) {
    return { mapped: [], skipped: [] };
  }

  const project = await getProject(projectId);
  if (!project) {
    return { mapped: [], skipped: ["Project not found"] };
  }

  const mappedLanguages: TMappedLanguage[] = [];
  const skipped: string[] = [];

  for (const exportedLang of exportedLanguages) {
    const projectLanguage = project.languages.find((l) => l.code === exportedLang.code);
    if (!projectLanguage) {
      skipped.push(`Language ${exportedLang.code} not found in project`);
      continue;
    }

    mappedLanguages.push({
      languageId: projectLanguage.id,
      enabled: exportedLang.enabled,
      default: exportedLang.default,
    });
  }

  return { mapped: mappedLanguages, skipped };
};

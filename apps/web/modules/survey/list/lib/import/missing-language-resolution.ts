interface TResolveMissingProjectLanguagesInput {
  importedLanguageCodes: string[];
  existingLanguageCodes: string[];
  hasManagePermission: boolean;
  createLanguage: (code: string) => Promise<void>;
  refreshExistingLanguageCodes: () => Promise<string[]>;
  getLanguageNames: (languageCodes: string[]) => string[];
}

interface TResolveMissingProjectLanguagesResult {
  createdLanguageCodes: string[];
  errorMessage?: string;
}

const getMissingLanguageCodes = (importedLanguageCodes: string[], existingLanguageCodes: string[]) => {
  const uniqueImported = [...new Set(importedLanguageCodes)];
  return uniqueImported.filter((code) => !existingLanguageCodes.includes(code));
};

export const resolveMissingProjectLanguages = async ({
  importedLanguageCodes,
  existingLanguageCodes,
  hasManagePermission,
  createLanguage,
  refreshExistingLanguageCodes,
  getLanguageNames,
}: TResolveMissingProjectLanguagesInput): Promise<TResolveMissingProjectLanguagesResult> => {
  const missingLanguageCodes = getMissingLanguageCodes(importedLanguageCodes, existingLanguageCodes);
  if (missingLanguageCodes.length === 0) {
    return { createdLanguageCodes: [] };
  }

  if (!hasManagePermission) {
    const missingLanguageNames = getLanguageNames(missingLanguageCodes);
    return {
      createdLanguageCodes: [],
      errorMessage: `This import contains languages not configured in your project: ${missingLanguageNames.join(
        ", "
      )}. You need workspace manage permissions to auto-create missing languages. Please add them in Project Configuration or ask a project manager.`,
    };
  }

  const createdLanguageCodes: string[] = [];
  for (const code of missingLanguageCodes) {
    try {
      await createLanguage(code);
      createdLanguageCodes.push(code);
    } catch {}
  }

  const refreshedExistingLanguageCodes = await refreshExistingLanguageCodes();
  const unresolvedLanguageCodes = getMissingLanguageCodes(
    importedLanguageCodes,
    refreshedExistingLanguageCodes
  );

  if (unresolvedLanguageCodes.length > 0) {
    const unresolvedLanguageNames = getLanguageNames(unresolvedLanguageCodes);
    return {
      createdLanguageCodes,
      errorMessage: `Import could not auto-create these project languages: ${unresolvedLanguageNames.join(
        ", "
      )}. Please add them in Project Configuration and try again.`,
    };
  }

  return { createdLanguageCodes };
};

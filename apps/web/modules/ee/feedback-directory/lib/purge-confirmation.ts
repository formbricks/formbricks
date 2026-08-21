const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Whether the typed confirmation matches the dataset's name.
 *
 * Trimmed and case-insensitive: the point of typing the name is to prove you know which dataset you
 * are emptying, not to test your shift key. Extracted so the rule is testable on its own rather than
 * inlined in a `disabled` prop, mirroring the workspace-delete confirmation.
 */
export const hasMatchingDatasetPurgeConfirmation = (confirmationName: string, datasetName: string): boolean =>
  normalize(confirmationName) === normalize(datasetName) && normalize(datasetName) !== "";

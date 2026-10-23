/**
 * Writes `text` to the clipboard and resolves to whether it actually got there. Never rejects: the
 * browser can refuse the write (`NotAllowedError` on a lost focus, an insecure context with no
 * `navigator.clipboard`), and callers must only report success when this returns `true`.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

/**
 * The file name a `Content-Disposition` header gives (RFC 6266): the UTF-8 `filename*` when there is a
 * readable one, else the plain `filename`, quoted or not. Null when the header names none. Any path is
 * dropped, so the name can only ever be a name.
 */
export const getContentDispositionFileName = (header: string | null): string | null => {
  if (!header) return null;

  const extended = /(?:^|;)\s*filename\*\s*=\s*utf-8'[^']*'([^;\s]+)/i.exec(header);
  if (extended) {
    try {
      const name = toBaseName(decodeURIComponent(extended[1]));
      if (name) return name;
    } catch {
      // A malformed percent-encoding: fall back to the plain parameter.
    }
  }

  const plain = /(?:^|;)\s*filename\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^;\s]+))/i.exec(header);
  if (!plain) return null;
  const quoted = plain[1];
  const name = toBaseName(quoted === undefined ? plain[2] : quoted.replaceAll(/\\(.)/g, "$1"));
  return name || null;
};

const toBaseName = (name: string): string => name.split(/[/\\]/).pop()?.trim() ?? "";

/**
 * Hand a downloaded body to the browser as a file: a temporary object URL behind a hidden link,
 * clicked once and revoked straight after the click has started the download.
 */
export const saveBlobAsFile = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    // Revoked on the next task: some browsers read the URL only after `click()` has returned.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
};

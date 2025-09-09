export const downloadResponsesFile = (
  fileName: string,
  fileContents: string,
  fileType: "csv" | "xlsx"
): void => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("downloadResponsesFile can only be used in a browser environment");
  }

  const trimmedName = (fileName ?? "").trim();
  const requiredExt = fileType === "xlsx" ? ".xlsx" : ".csv";
  let normalizedFileName = trimmedName || `responses-${new Date().toISOString().slice(0, 10)}${requiredExt}`;
  if (!normalizedFileName.toLowerCase().endsWith(requiredExt)) {
    normalizedFileName = `${normalizedFileName}${requiredExt}`;
  }

  let file: File;

  if (fileType === "xlsx") {
    const binaryString = atob(fileContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    file = new File([bytes], normalizedFileName, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  } else {
    file = new File([fileContents], normalizedFileName, {
      type: "text/csv;charset=utf-8",
    });
  }

  const link = document.createElement("a");
  let url: string | undefined;

  url = URL.createObjectURL(file);
  link.href = url;
  link.download = normalizedFileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

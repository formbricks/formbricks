export const downloadResponsesFile = async (
  fileName: string,
  fileContents: string,
  filetype: "csv" | "xlsx"
) => {
  let file: File;

  if (filetype === "xlsx") {
    // Convert base64 back to binary data for XLSX files
    const binaryString = atob(fileContents);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    file = new File([bytes], fileName, {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  } else {
    // For CSV files, use the string directly
    file = new File([fileContents], fileName, {
      type: "text/csv",
    });
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

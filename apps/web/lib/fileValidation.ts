// filepath: /Users/dhruwang/Desktop/formbricks/apps/web/lib/fileValidation.ts

// List of blocked file extensions that could potentially be used for malicious purposes
export const BLOCKED_FILE_EXTENSIONS = [
  "ashx",
  "bak",
  "bat",
  "bck",
  "bin",
  "bkp",
  "cer",
  "cfg",
  "cgi",
  "cmd",
  "conf",
  "config",
  "crt",
  "dat",
  "der",
  "dll",
  "do",
  "eml",
  "exe",
  "hta",
  "htr",
  "htw",
  "ida",
  "idc",
  "idq",
  "ini",
  "java",
  "jsp",
  "key",
  "log",
  "lua",
  "msi",
  "nws",
  "old",
  "p12",
  "p7b",
  "p7c",
  "pem",
  "pfx",
  "pol",
  "printer",
  "py",
  "css",
  "reg",
  "sav",
  "save",
  "shtm",
  "shtml",
  "html",
  "js",
  "php",
  "stm",
  "sys",
  "temp",
  "tmp",
  "wmz",
];

/**
 * Validates if the file extension is allowed
 * @param fileName The name of the file to validate
 * @returns {boolean} True if the file extension is allowed, false otherwise
 */
export const isAllowedFileExtension = (fileName: string): boolean => {
  // Extract the file extension
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || extension === fileName.toLowerCase()) return false;

  // Check if the extension is in the blocked list
  return !BLOCKED_FILE_EXTENSIONS.includes(extension);
};

/**
 * Validates if the file type matches the extension
 * @param fileName The name of the file
 * @param mimeType The MIME type of the file
 * @returns {boolean} True if the file type matches the extension, false otherwise
 */
export const isValidFileTypeForExtension = (fileName: string, mimeType: string): boolean => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (!extension || extension === fileName.toLowerCase()) return false;

  // Basic MIME type validation for common file types
  const mimeTypeLower = mimeType.toLowerCase();

  // Map of extensions to expected MIME types
  const commonMimeTypes: Record<string, string[]> = {
    jpg: ["image/jpeg", "image/jpg"],
    jpeg: ["image/jpeg", "image/jpg"],
    png: ["image/png"],
    gif: ["image/gif"],
    webp: ["image/webp"],
    pdf: ["application/pdf"],
    doc: ["application/msword"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    xls: ["application/vnd.ms-excel"],
    xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    csv: ["text/csv", "application/csv"],
    txt: ["text/plain"],
    mp4: ["video/mp4"],
    mp3: ["audio/mpeg"],
    mov: ["video/quicktime"],
    zip: ["application/zip"],
    rar: ["application/x-rar-compressed"],
    // Add more as needed
  };

  // If we don't have a mapping for this extension, allow it
  // This is to avoid blocking legitimate but uncommon file types
  if (!commonMimeTypes[extension]) {
    return true;
  }

  // Check if the MIME type matches the expected type for this extension
  return commonMimeTypes[extension].includes(mimeTypeLower);
};

/**
 * Validates a file for security concerns
 * @param fileName The name of the file to validate
 * @param mimeType The MIME type of the file
 * @returns {object} An object with validation result and error message if any
 */
export const validateFile = (fileName: string, mimeType: string): { valid: boolean; error?: string } => {
  // Check for disallowed extensions
  if (!isAllowedFileExtension(fileName)) {
    return { valid: false, error: "File type not allowed for security reasons." };
  }

  // Check if the file type matches the extension
  if (!isValidFileTypeForExtension(fileName, mimeType)) {
    return { valid: false, error: "File type doesn't match the file extension." };
  }

  return { valid: true };
};

export const extractSpreadsheetIdFromUrl = (url: string): string => {
  // [UseTusk]

  const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const match = url.match(regex);
  if (match && match[1]) {
    return match[1];
  } else {
    throw new Error("Invalid Google Sheets URL");
  }
};

export const constructGoogleSheetsUrl = (spreadsheetId: string): string => {
  // [UseTusk]

  const baseUrl = "https://docs.google.com/spreadsheets/d/";
  return baseUrl + spreadsheetId;
};

export const isValidGoogleSheetsUrl = (url: string): boolean => {
  // [UseTusk]

  return url.startsWith("https://docs.google.com/spreadsheets/d/");
};

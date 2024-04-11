export const processResponseData = (
  responseData: string | number | string[] | Record<string, string>
): string => {
  if (!responseData) return "";

  switch (typeof responseData) {
    case "string":
      return responseData;

    case "number":
      return responseData.toString();

    case "object":
      if (Array.isArray(responseData)) {
        return responseData.join("; ");
      } else {
        const formattedString = Object.entries(responseData)
          .filter(([_, value]) => value.trim() !== "") // Filter out entries with empty string values
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
        return formattedString;
      }

    default:
      return "";
  }
};

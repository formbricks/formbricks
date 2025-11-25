export const processResponseData = (
  responseData: string | number | string[] | Record<string, string>
): string => {
  switch (typeof responseData) {
    case "string":
      return responseData;

    case "number":
      return responseData.toString();

    case "object":
      if (Array.isArray(responseData)) {
        responseData = responseData
          .filter((item) => item !== null && item !== undefined && item !== "")
          .join("; ");
        return responseData;
      } else {
        const formattedString = Object.entries(responseData)
          .filter(([_, value]) => value !== "")
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n");
        return formattedString;
      }

    default:
      return "";
  }
};

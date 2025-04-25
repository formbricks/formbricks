import { TIntegration } from "@formbricks/types/integration";

export const convertDatesInObject = <T>(obj: T): T => {
  if (obj === null || typeof obj !== "object") {
    return obj; // Return if obj is not an object
  }
  if (Array.isArray(obj)) {
    // Handle arrays by mapping each element through the function
    return obj.map((item) => convertDatesInObject(item)) as unknown as T;
  }
  const newObj: any = {};
  for (const key in obj) {
    if (
      (key === "createdAt" || key === "updatedAt") &&
      typeof obj[key] === "string" &&
      !isNaN(Date.parse(obj[key] as unknown as string))
    ) {
      newObj[key] = new Date(obj[key] as unknown as string);
    } else if (typeof obj[key] === "object" && obj[key] !== null) {
      newObj[key] = convertDatesInObject(obj[key]);
    } else {
      newObj[key] = obj[key];
    }
  }
  return newObj;
};

export const transformIntegration = (integration: TIntegration): TIntegration => {
  return {
    ...integration,
    config: {
      ...integration.config,
      data: integration.config.data.map((data) => ({
        ...data,
        createdAt: new Date(data.createdAt),
      })),
    },
  };
};

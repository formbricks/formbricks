import { TDisplay } from "@formbricks/types/displays";

export const formatDisplaysDateFields = (displays: TDisplay[]): TDisplay[] => {
  return displays.map((display) => ({
    ...display,
    createdAt: new Date(display.createdAt),
    updatedAt: new Date(display.updatedAt),
  }));
};

import { NotificationSettings } from "@formbricks/types/users";

export interface Membership {
  team: {
    id: string;
    name: string;
    products: {
      id: string;
      name: string;
      environments: {
        id: string;
        surveys: {
          id: string;
          name: string;
        }[];
      }[];
    }[];
  };
}

export interface User {
  id: string;
  notificationSettings: NotificationSettings;
}

import { TUserNotificationSettings } from "@formbricks/types/user";

export interface Membership {
  organization: {
    id: string;
    name: string;
    projects: {
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
  notificationSettings: TUserNotificationSettings;
}

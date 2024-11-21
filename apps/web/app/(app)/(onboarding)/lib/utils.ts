import { TProjectConfigChannel } from "@formbricks/types/project";

export const getCustomHeadline = (channel?: TProjectConfigChannel) => {
  switch (channel) {
    case "website":
      return "organizations.projects.new.settings.website_channel_headline";
    case "app":
      return "organizations.projects.new.settings.app_channel_headline";
    default:
      return "organizations.projects.new.settings.link_channel_headline";
  }
};

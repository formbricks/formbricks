import { TProjectConfigChannel } from "@formbricks/types/project";

export const getCustomHeadline = (channel?: TProjectConfigChannel) => {
  switch (channel) {
    case "website":
      return "organizations.products.new.settings.website_channel_headline";
    case "app":
      return "organizations.products.new.settings.app_channel_headline";
    default:
      return "organizations.products.new.settings.link_channel_headline";
  }
};

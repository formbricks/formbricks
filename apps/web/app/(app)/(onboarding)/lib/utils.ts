import { TProductConfigChannel } from "@formbricks/types/product";

export const getCustomHeadline = (channel?: TProductConfigChannel) => {
  switch (channel) {
    case "website":
      return "Let's get the most out of your website traffic!";
    case "app":
      return "Let's research what your users need!";
    default:
      return "You maintain a product, how exciting!";
  }
};

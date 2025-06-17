import { funEmoji } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

export function generateAvatar(identifier: string, isCommunity: boolean = false): string {
  const seed = isCommunity ? `${identifier.toLowerCase()}_community` : identifier.toLowerCase();

  const avatar = createAvatar(funEmoji, {
    seed,
  });

  const svgString = avatar.toString();
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)}`;

  return dataUrl;
}

export function generateUserAvatar(email: string): string {
  return generateAvatar(email, false);
}

export function generateCommunityAvatar(email: string): string {
  return generateAvatar(email, true);
}

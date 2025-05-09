import { funEmoji } from "@dicebear/collection";
import { createAvatar } from "@dicebear/core";

export function generateUserAvatar(email: string): string {
  const seed = email.toLowerCase();

  const avatar = createAvatar(funEmoji, {
    seed,
  });

  const svgString = avatar.toString();
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(svgString)}`;

  return dataUrl;
}
